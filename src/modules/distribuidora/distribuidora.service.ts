import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CreateDistribuidoraClientDto } from "./dto/create-distribuidora-client.dto";
import { CreateDistribuidoraOrderDto } from "./dto/create-distribuidora-order.dto";
import { CreateDistribuidoraProductDto } from "./dto/create-distribuidora-product.dto";
import {
  DistribuidoraClient,
  DistribuidoraOrder,
  DistribuidoraOrderItem,
  DistribuidoraOrderStatus,
  DistribuidoraProduct
} from "./distribuidora.types";

type ClientRow = RowDataPacket & {
  id: number;
  name: string;
  rut: string | null;
  address: string | null;
  phone: string | null;
};

type ProductRow = RowDataPacket & {
  id: number;
  name: string;
  price: string;
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

const CLIENT_COLUMNS = "id, name, rut, address, phone";

// Las fechas se guardan en UTC (UTC_TIMESTAMP) y se traen con DATE_FORMAT
// ya terminadas en "Z" -- mysql2 NO debe construir el Date (bug de +3hs
// encontrado el 18/09/2026, ver scripts/check-oriol-activity.js).
const ORDER_COLUMNS = `id, client_id, client_name, client_rut, client_address, items, total, note, status, invoice_number,
  DATE_FORMAT(invoiced_at, '%Y-%m-%dT%H:%i:%sZ') AS invoiced_at,
  DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at`;

const SEARCH_LIMIT = 50;
const ORDERS_LIMIT = 200;

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function cleanOptional(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function mapProduct(row: ProductRow): DistribuidoraProduct {
  return { id: row.id, name: row.name, price: Number(row.price) };
}

function mapClient(row: ClientRow): DistribuidoraClient {
  return { id: row.id, name: row.name, rut: row.rut, address: row.address, phone: row.phone };
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
  constructor(private readonly databaseService: DatabaseService) {}

  async listClients(search?: string): Promise<DistribuidoraClient[]> {
    const term = search?.trim();
    const rows = term
      ? await this.databaseService.query<ClientRow[]>(
          `SELECT ${CLIENT_COLUMNS} FROM saas_distribuidora_clients
           WHERE name LIKE ? OR rut LIKE ?
           ORDER BY name ASC LIMIT ${SEARCH_LIMIT}`,
          [`%${term}%`, `%${term}%`]
        )
      : await this.databaseService.query<ClientRow[]>(
          `SELECT ${CLIENT_COLUMNS} FROM saas_distribuidora_clients ORDER BY name ASC LIMIT ${SEARCH_LIMIT}`
        );

    return rows.map(mapClient);
  }

  async createClient(dto: CreateDistribuidoraClientDto): Promise<DistribuidoraClient> {
    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_distribuidora_clients (name, rut, address, phone) VALUES (?, ?, ?, ?)`,
      [dto.name.trim(), cleanOptional(dto.rut), cleanOptional(dto.address), cleanOptional(dto.phone)]
    );

    const rows = await this.databaseService.query<ClientRow[]>(
      `SELECT ${CLIENT_COLUMNS} FROM saas_distribuidora_clients WHERE id = ?`,
      [result.insertId]
    );
    return mapClient(rows[0]);
  }

  async listProducts(search?: string): Promise<DistribuidoraProduct[]> {
    const term = search?.trim();
    const rows = term
      ? await this.databaseService.query<ProductRow[]>(
          `SELECT id, name, price FROM saas_distribuidora_products
           WHERE status = 'active' AND name LIKE ?
           ORDER BY name ASC LIMIT ${SEARCH_LIMIT}`,
          [`%${term}%`]
        )
      : await this.databaseService.query<ProductRow[]>(
          `SELECT id, name, price FROM saas_distribuidora_products
           WHERE status = 'active' ORDER BY name ASC LIMIT ${SEARCH_LIMIT}`
        );

    return rows.map(mapProduct);
  }

  async createProduct(dto: CreateDistribuidoraProductDto): Promise<DistribuidoraProduct> {
    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_distribuidora_products (name, price) VALUES (?, ?)`,
      [dto.name.trim(), dto.price]
    );
    return { id: result.insertId, name: dto.name.trim(), price: dto.price };
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

  async createOrder(dto: CreateDistribuidoraOrderDto): Promise<DistribuidoraOrder> {
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

    return this.getOrder(result.insertId);
  }

  // La oficina "toma" el pedido y lo pasa a boleta: se le asigna el
  // numero siguiente. Volver a facturar un pedido ya facturado no cambia
  // nada (devuelve la misma boleta), asi un doble click no gasta numeros.
  async invoiceOrder(orderId: number): Promise<DistribuidoraOrder> {
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
    });

    return this.getOrder(orderId);
  }
}
