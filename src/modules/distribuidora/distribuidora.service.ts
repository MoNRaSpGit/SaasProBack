import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CreateDistribuidoraClientDto } from "./dto/create-distribuidora-client.dto";
import { CreateDistribuidoraOrderDto } from "./dto/create-distribuidora-order.dto";
import { CreateDistribuidoraProductDto } from "./dto/create-distribuidora-product.dto";
import { UpdateDistribuidoraOrderDto } from "./dto/update-distribuidora-order.dto";
import { UpdateDistribuidoraProductDto } from "./dto/update-distribuidora-product.dto";
import {
  DistribuidoraAuditAction,
  DistribuidoraAuditContext,
  DistribuidoraClient,
  DistribuidoraOrder,
  DistribuidoraOrderItem,
  DistribuidoraOrderStatus,
  DistribuidoraProduct
} from "./distribuidora.types";

type ClientRow = RowDataPacket & {
  id: number;
  code: string | null;
  name: string;
  contact_name: string | null;
  rut: string | null;
  address: string | null;
  phone: string | null;
};

type ProductRow = RowDataPacket & {
  id: number;
  code: string | null;
  name: string;
  category: string | null;
  price: string;
  status: "active" | "inactive";
};

type OrderRow = RowDataPacket & {
  id: number;
  client_id: number | null;
  client_name: string;
  client_rut: string | null;
  client_address: string | null;
  items: string | DistribuidoraOrderItem[];
  total: string;
  note: string | null;
  status: DistribuidoraOrderStatus;
  invoice_number: number | null;
  invoiced_at: string | null;
  created_at: string;
};

const CLIENT_COLUMNS = "id, code, name, contact_name, rut, address, phone";

// Las fechas se guardan en UTC (UTC_TIMESTAMP) y se traen con DATE_FORMAT
// ya terminadas en "Z" -- mysql2 NO debe construir el Date (bug de +3hs
// encontrado el 18/09/2026, ver scripts/check-oriol-activity.js).
const ORDER_COLUMNS = `id, client_id, client_name, client_rut, client_address, items, total, note, status, invoice_number,
  DATE_FORMAT(invoiced_at, '%Y-%m-%dT%H:%i:%sZ') AS invoiced_at,
  DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at`;

const PRODUCT_COLUMNS = "id, code, name, category, price, status";

const SEARCH_LIMIT = 50;
// La pestana Productos de la oficina lista el catalogo entero.
const CATALOG_LIMIT = 1000;
const ORDERS_LIMIT = 200;

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function cleanOptional(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function formatInvoice(invoiceNumber: number) {
  return `A ${String(invoiceNumber).padStart(6, "0")}`;
}

function mapProduct(row: ProductRow): DistribuidoraProduct {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    price: Number(row.price),
    active: row.status === "active"
  };
}

function mapClient(row: ClientRow): DistribuidoraClient {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    contactName: row.contact_name,
    rut: row.rut,
    address: row.address,
    phone: row.phone
  };
}

function mapOrder(row: OrderRow): DistribuidoraOrder {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    clientRut: row.client_rut,
    clientAddress: row.client_address,
    // La columna JSON puede venir ya parseada o como string segun el driver.
    items: typeof row.items === "string" ? (JSON.parse(row.items) as DistribuidoraOrderItem[]) : row.items,
    total: Number(row.total),
    note: row.note,
    status: row.status,
    invoiceNumber: row.invoice_number,
    invoicedAt: row.invoiced_at,
    createdAt: row.created_at
  };
}

@Injectable()
export class DistribuidoraService {
  private readonly logger = new Logger(DistribuidoraService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  // Auditoria interna -- PARA NOSOTROS, no hay pantalla en la app que la
  // muestre (se consulta con scripts/inspect-distribuidora-audit.js).
  // before/after guardan la foto completa: sirve para reconstruir un
  // pedido o una boleta que se borro. Nunca tira error: si el registro
  // falla, la operacion del usuario ya se hizo y no se le rompe.
  private async audit(
    action: DistribuidoraAuditAction,
    entityId: number,
    summary: string,
    context: DistribuidoraAuditContext | undefined,
    before: unknown = null,
    after: unknown = null
  ) {
    try {
      await this.databaseService.execute<ResultSetHeader>(
        `INSERT INTO saas_distribuidora_audit_log
           (occurred_at, action, entity_id, summary, before_json, after_json, device_id, user_agent)
         VALUES (UTC_TIMESTAMP(), ?, ?, ?, ?, ?, ?, ?)`,
        [
          action,
          entityId,
          summary.slice(0, 255),
          before === null ? null : JSON.stringify(before),
          after === null ? null : JSON.stringify(after),
          context?.deviceId ?? null,
          context?.userAgent?.slice(0, 255) ?? null
        ]
      );
    } catch (error) {
      this.logger.warn(`No se pudo registrar la auditoria de ${action} #${entityId}: ${(error as Error).message}`);
    }
  }

  async listClients(search?: string): Promise<DistribuidoraClient[]> {
    const term = search?.trim();
    if (!term) {
      const rows = await this.databaseService.query<ClientRow[]>(
        `SELECT ${CLIENT_COLUMNS} FROM saas_distribuidora_clients ORDER BY name ASC LIMIT ${SEARCH_LIMIT}`
      );
      return rows.map(mapClient);
    }

    // Cada palabra tiene que estar en el nombre del negocio, en la persona
    // o en la direccion, en cualquier orden: hay cientos de "Almacen" y el
    // vendedor los distingue por la duena o la calle ("almacen ana",
    // "kiosco san martin"). Tambien se encuentra por RUT o por codigo.
    const words = term.split(/\s+/).slice(0, 6);
    const wordCondition = words.map(() => "CONCAT_WS(' ', name, contact_name, address) LIKE ?").join(" AND ");
    const rows = await this.databaseService.query<ClientRow[]>(
      `SELECT ${CLIENT_COLUMNS} FROM saas_distribuidora_clients
       WHERE (${wordCondition}) OR rut LIKE ? OR code LIKE ?
       ORDER BY name ASC LIMIT ${SEARCH_LIMIT}`,
      [...words.map((word) => `%${word}%`), `${term}%`, `${term}%`]
    );

    return rows.map(mapClient);
  }

  async createClient(dto: CreateDistribuidoraClientDto, context?: DistribuidoraAuditContext): Promise<DistribuidoraClient> {
    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_distribuidora_clients (name, rut, address, phone) VALUES (?, ?, ?, ?)`,
      [dto.name.trim(), cleanOptional(dto.rut), cleanOptional(dto.address), cleanOptional(dto.phone)]
    );

    const rows = await this.databaseService.query<ClientRow[]>(
      `SELECT ${CLIENT_COLUMNS} FROM saas_distribuidora_clients WHERE id = ?`,
      [result.insertId]
    );
    const client = mapClient(rows[0]);
    await this.audit("client_create", client.id, `Alta de cliente "${client.name}"`, context, null, client);
    return client;
  }

  // includeInactive = la vista de la oficina (catalogo entero, con los
  // dados de baja). El vendedor solo ve los activos.
  async listProducts(search?: string, includeInactive = false): Promise<DistribuidoraProduct[]> {
    const term = search?.trim();
    const conditions: string[] = [];
    const values: string[] = [];
    if (!includeInactive) conditions.push("status = 'active'");
    if (term) {
      // Cada palabra tiene que estar en el nombre, en cualquier orden
      // ("detergente manzana" encuentra "Detergente Aromas 750cc manzana").
      // Tambien se puede buscar por el codigo de la planilla.
      const words = term.split(/\s+/).slice(0, 6);
      conditions.push(`((${words.map(() => "name LIKE ?").join(" AND ")}) OR code LIKE ?)`);
      values.push(...words.map((word) => `%${word}%`), `${term}%`);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const rows = await this.databaseService.query<ProductRow[]>(
      `SELECT ${PRODUCT_COLUMNS} FROM saas_distribuidora_products ${where}
       ORDER BY name ASC LIMIT ${includeInactive ? CATALOG_LIMIT : SEARCH_LIMIT}`,
      values
    );

    return rows.map(mapProduct);
  }

  async createProduct(dto: CreateDistribuidoraProductDto, context?: DistribuidoraAuditContext): Promise<DistribuidoraProduct> {
    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_distribuidora_products (name, price) VALUES (?, ?)`,
      [dto.name.trim(), dto.price]
    );
    const product: DistribuidoraProduct = {
      id: result.insertId,
      code: null,
      name: dto.name.trim(),
      category: null,
      price: dto.price,
      active: true
    };
    await this.audit("product_create", product.id, `Alta de producto "${product.name}" a ${product.price}`, context, null, product);
    return product;
  }

  // Editar un producto no toca los pedidos ya tomados: cada pedido guarda
  // su propia foto de nombre y precio.
  async updateProduct(
    productId: number,
    dto: UpdateDistribuidoraProductDto,
    context?: DistribuidoraAuditContext
  ): Promise<DistribuidoraProduct> {
    const beforeRows = await this.databaseService.query<ProductRow[]>(
      `SELECT ${PRODUCT_COLUMNS} FROM saas_distribuidora_products WHERE id = ?`,
      [productId]
    );
    if (!beforeRows[0]) {
      throw new NotFoundException("No existe ese producto.");
    }
    const before = mapProduct(beforeRows[0]);

    const sets: string[] = [];
    const values: Array<string | number> = [];
    if (dto.name !== undefined) {
      sets.push("name = ?");
      values.push(dto.name.trim());
    }
    if (dto.price !== undefined) {
      sets.push("price = ?");
      values.push(dto.price);
    }
    if (dto.active !== undefined) {
      sets.push("status = ?");
      values.push(dto.active ? "active" : "inactive");
    }

    if (sets.length > 0) {
      await this.databaseService.execute<ResultSetHeader>(
        `UPDATE saas_distribuidora_products SET ${sets.join(", ")} WHERE id = ?`,
        [...values, productId]
      );
    }

    const rows = await this.databaseService.query<ProductRow[]>(
      `SELECT ${PRODUCT_COLUMNS} FROM saas_distribuidora_products WHERE id = ?`,
      [productId]
    );
    if (!rows[0]) {
      throw new NotFoundException("No existe ese producto.");
    }
    const after = mapProduct(rows[0]);

    const changes: string[] = [];
    if (before.name !== after.name) changes.push(`nombre: "${before.name}" -> "${after.name}"`);
    if (before.price !== after.price) changes.push(`precio: ${before.price} -> ${after.price}`);
    if (before.active !== after.active) changes.push(after.active ? "reactivado" : "dado de baja");
    // Guardar sin cambiar nada no es un movimiento: no se registra.
    if (changes.length > 0) {
      await this.audit("product_update", after.id, `Producto "${after.name}": ${changes.join("; ")}`, context, before, after);
    }
    return after;
  }

  async listOrders(status?: DistribuidoraOrderStatus): Promise<DistribuidoraOrder[]> {
    const rows = status
      ? await this.databaseService.query<OrderRow[]>(
          `SELECT ${ORDER_COLUMNS} FROM saas_distribuidora_orders WHERE status = ?
           ORDER BY created_at DESC, id DESC LIMIT ${ORDERS_LIMIT}`,
          [status]
        )
      : await this.databaseService.query<OrderRow[]>(
          `SELECT ${ORDER_COLUMNS} FROM saas_distribuidora_orders ORDER BY created_at DESC, id DESC LIMIT ${ORDERS_LIMIT}`
        );

    return rows.map(mapOrder);
  }

  async getOrder(orderId: number): Promise<DistribuidoraOrder> {
    const rows = await this.databaseService.query<OrderRow[]>(
      `SELECT ${ORDER_COLUMNS} FROM saas_distribuidora_orders WHERE id = ?`,
      [orderId]
    );
    if (!rows[0]) {
      throw new NotFoundException("No existe ese pedido.");
    }
    return mapOrder(rows[0]);
  }

  async createOrder(dto: CreateDistribuidoraOrderDto, context?: DistribuidoraAuditContext): Promise<DistribuidoraOrder> {
    const clients = await this.databaseService.query<ClientRow[]>(
      `SELECT ${CLIENT_COLUMNS} FROM saas_distribuidora_clients WHERE id = ?`,
      [dto.clientId]
    );
    const client = clients[0];
    if (!client) {
      throw new BadRequestException("El cliente no existe.");
    }

    // Si el mismo producto viene en dos renglones, se junta en uno.
    const quantities = new Map<number, number>();
    for (const item of dto.items) {
      quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
    }

    const productIds = [...quantities.keys()];
    const products = await this.databaseService.query<ProductRow[]>(
      `SELECT id, name, price FROM saas_distribuidora_products
       WHERE status = 'active' AND id IN (${productIds.map(() => "?").join(", ")})`,
      productIds
    );
    const productsById = new Map(products.map((product) => [product.id, product]));

    const items: DistribuidoraOrderItem[] = productIds.map((productId) => {
      const product = productsById.get(productId);
      if (!product) {
        throw new BadRequestException(`El producto ${productId} no existe o esta dado de baja.`);
      }
      const price = Number(product.price);
      const quantity = quantities.get(productId)!;
      return { productId, name: product.name, price, quantity, subtotal: roundMoney(price * quantity) };
    });
    const total = roundMoney(items.reduce((sum, item) => sum + item.subtotal, 0));

    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_distribuidora_orders (client_id, client_name, client_rut, client_address, items, total, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
      [client.id, client.name, client.rut, client.address, JSON.stringify(items), total, cleanOptional(dto.note)]
    );

    const order = await this.getOrder(result.insertId);
    await this.audit(
      "order_create",
      order.id,
      `Pedido N.º ${order.id} de "${order.clientName}" por ${order.total} (${order.items.length} producto(s))`,
      context,
      null,
      order
    );
    return order;
  }

  // Editar un pedido PENDIENTE (uno ya facturado no se toca: la boleta
  // ya salio con ese numero). Se manda la lista completa de renglones.
  // Los productos que ya estaban conservan el nombre y el precio con que
  // se tomo el pedido; los que se agregan entran al precio de hoy.
  async updateOrder(
    orderId: number,
    dto: UpdateDistribuidoraOrderDto,
    context?: DistribuidoraAuditContext
  ): Promise<DistribuidoraOrder> {
    const current = await this.getOrder(orderId);
    if (current.status !== "pendiente") {
      throw new ConflictException("Ese pedido ya tiene boleta: no se puede editar.");
    }

    const quantities = new Map<number, number>();
    for (const item of dto.items) {
      quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
    }

    const currentById = new Map(current.items.map((item) => [item.productId, item]));
    const newProductIds = [...quantities.keys()].filter((productId) => !currentById.has(productId));
    const newProducts =
      newProductIds.length > 0
        ? await this.databaseService.query<ProductRow[]>(
            `SELECT id, name, price FROM saas_distribuidora_products
             WHERE status = 'active' AND id IN (${newProductIds.map(() => "?").join(", ")})`,
            newProductIds
          )
        : [];
    const newProductsById = new Map(newProducts.map((product) => [product.id, product]));

    const items: DistribuidoraOrderItem[] = [...quantities.entries()].map(([productId, quantity]) => {
      const existing = currentById.get(productId);
      const product = newProductsById.get(productId);
      if (!existing && !product) {
        throw new BadRequestException(`El producto ${productId} no existe o esta dado de baja.`);
      }
      const name = existing ? existing.name : product!.name;
      const price = existing ? existing.price : Number(product!.price);
      return { productId, name, price, quantity, subtotal: roundMoney(price * quantity) };
    });
    const total = roundMoney(items.reduce((sum, item) => sum + item.subtotal, 0));

    // El "AND status" evita pisar un pedido que se facturo justo mientras
    // se lo estaba editando.
    const result = await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_distribuidora_orders SET items = ?, total = ?, note = ? WHERE id = ? AND status = 'pendiente'`,
      [JSON.stringify(items), total, cleanOptional(dto.note), orderId]
    );
    if (result.affectedRows === 0) {
      throw new ConflictException("Ese pedido ya tiene boleta: no se puede editar.");
    }

    const updated = await this.getOrder(orderId);
    await this.audit(
      "order_update",
      updated.id,
      `Edicion del pedido N.º ${updated.id} de "${updated.clientName}": ${current.total} -> ${updated.total}`,
      context,
      current,
      updated
    );
    return updated;
  }

  // Un pedido pendiente se elimina sin mas. Uno ya facturado tambien se
  // puede (09/10/2026, pedido explicito: "de todas maneras se pueda
  // borrar"), pero solo si se pide a proposito con allowInvoiced: asi un
  // "eliminar" confirmado sobre un pedido que se facturo justo en el
  // medio no se lleva puesta una boleta sin querer.
  // OJO numeracion: el proximo numero de boleta es el maximo + 1, asi que
  // borrar la ULTIMA boleta hace que su numero se vuelva a usar, y borrar
  // una del medio deja un hueco.
  async deleteOrder(orderId: number, allowInvoiced = false, context?: DistribuidoraAuditContext): Promise<void> {
    const current = await this.getOrder(orderId);
    if (current.status !== "pendiente" && !allowInvoiced) {
      throw new ConflictException("Ese pedido ya tiene boleta. Para eliminarlo, dejalo apretado en Facturados.");
    }

    const result = await this.databaseService.execute<ResultSetHeader>(
      `DELETE FROM saas_distribuidora_orders WHERE id = ? AND (status = 'pendiente' OR ? = 1)`,
      [orderId, allowInvoiced ? 1 : 0]
    );
    if (result.affectedRows === 0) {
      throw new ConflictException("Ese pedido ya tiene boleta. Para eliminarlo, dejalo apretado en Facturados.");
    }

    // Queda la foto completa del pedido borrado: es la unica copia.
    const label =
      current.invoiceNumber !== null
        ? `BOLETA ${formatInvoice(current.invoiceNumber)} (pedido N.º ${current.id})`
        : `pedido N.º ${current.id}`;
    await this.audit("order_delete", current.id, `Se elimino ${label} de "${current.clientName}" por ${current.total}`, context, current, null);
  }

  // La oficina "toma" el pedido y lo pasa a boleta: se le asigna el
  // numero siguiente. Volver a facturar un pedido ya facturado no cambia
  // nada (devuelve la misma boleta), asi un doble click no gasta numeros.
  async invoiceOrder(orderId: number, context?: DistribuidoraAuditContext): Promise<DistribuidoraOrder> {
    let invoicedNow = false;
    await this.databaseService.withTransaction(async (connection) => {
      const [rows] = await connection.query<OrderRow[]>(
        `SELECT id, status FROM saas_distribuidora_orders WHERE id = ? FOR UPDATE`,
        [orderId]
      );
      if (!rows[0]) {
        throw new NotFoundException("No existe ese pedido.");
      }
      if (rows[0].status === "facturado") {
        return;
      }

      // FOR UPDATE sobre el maximo: dos facturaciones a la vez no pueden
      // sacar el mismo numero (ademas esta el UNIQUE de invoice_number).
      const [maxRows] = await connection.query<RowDataPacket[]>(
        `SELECT COALESCE(MAX(invoice_number), 0) AS last_number FROM saas_distribuidora_orders FOR UPDATE`
      );
      const nextNumber = Number(maxRows[0].last_number) + 1;

      await connection.query(
        `UPDATE saas_distribuidora_orders
         SET status = 'facturado', invoice_number = ?, invoiced_at = UTC_TIMESTAMP()
         WHERE id = ?`,
        [nextNumber, orderId]
      );
      invoicedNow = true;
    });

    const order = await this.getOrder(orderId);
    if (invoicedNow && order.invoiceNumber !== null) {
      await this.audit(
        "order_invoice",
        order.id,
        `Boleta ${formatInvoice(order.invoiceNumber)} generada para el pedido N.º ${order.id} de "${order.clientName}" por ${order.total}`,
        context,
        null,
        order
      );
    }
    return order;
  }
}
