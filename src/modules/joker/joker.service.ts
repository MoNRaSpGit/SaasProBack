import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { createSign } from "crypto";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CreateJokerAccountEntryDto } from "./dto/create-joker-account-entry.dto";
import { CreateJokerClientDto } from "./dto/create-joker-client.dto";
import { CreateJokerOrderDto } from "./dto/create-joker-order.dto";
import { CreateJokerProductDto } from "./dto/create-joker-product.dto";
import { ListJokerOrdersDto } from "./dto/list-joker-orders.dto";
import { UpdateJokerProductDto } from "./dto/update-joker-product.dto";
import { JokerAccountEntry, JokerClient, JokerOrder, JokerPaymentMethod, JokerProduct } from "./joker.types";

type JokerProductRow = RowDataPacket & {
  id: number;
  name: string;
  category: string;
  subcategory: string | null;
  subcategory_detail: string | null;
  brand: string | null;
  price: string | number;
  ingredients: string | null;
  observations: string | null;
  product_type: string;
  status: string;
  pricing_unit: string;
  created_at: string | Date;
  updated_at: string | Date;
};

type JokerOrderRow = RowDataPacket & {
  id: number;
  total: string | number;
  address: string;
  payment_method: string;
  items: string;
  created_at: string | Date;
};

type JokerClientRow = RowDataPacket & {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  created_at: string | Date;
};

type JokerAccountEntryRow = RowDataPacket & {
  id: number;
  client_id: number;
  total: string | number;
  items: string;
  created_at: string | Date;
};

const PRODUCT_COLUMNS = `
  id,
  name,
  category,
  subcategory,
  subcategory_detail,
  brand,
  price,
  ingredients,
  observations,
  product_type,
  status,
  pricing_unit,
  created_at,
  updated_at
`;

const ORDER_COLUMNS = `
  id,
  total,
  address,
  payment_method,
  items,
  created_at
`;

// El local (El Joker) opera en Montevideo (UTC-3); el "dia" del panel
// arranca y cierra a las 5am hora local (no a medianoche), para que un
// pedido despues de medianoche siga contando como parte del dia anterior.
const STORE_UTC_OFFSET_HOURS = 3;
const STORE_DAY_START_HOUR = 5;

@Injectable()
export class JokerService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listProducts(): Promise<{ items: JokerProduct[] }> {
    const rows = await this.databaseService.query<JokerProductRow[]>(
      `SELECT ${PRODUCT_COLUMNS}
       FROM saas_joker_products
       ORDER BY category ASC, name ASC
       LIMIT 1000`
    );

    return { items: rows.map((row) => this.mapProduct(row)) };
  }

  async createProduct(dto: CreateJokerProductDto): Promise<{ item: JokerProduct }> {
    const name = dto.name.trim();
    const category = dto.category?.trim() || "Otros";

    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_joker_products
         (name, category, subcategory, subcategory_detail, brand, price, ingredients, observations, product_type, status, pricing_unit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        category,
        dto.subcategory?.trim() || null,
        dto.subcategoryDetail?.trim() || null,
        dto.brand?.trim() || null,
        dto.price,
        dto.ingredients?.trim() || null,
        dto.observations?.trim() || null,
        dto.productType ?? "simple",
        dto.status ?? "published",
        dto.pricingUnit ?? "unidad"
      ]
    );

    const rows = await this.databaseService.query<JokerProductRow[]>(
      `SELECT ${PRODUCT_COLUMNS}
       FROM saas_joker_products
       WHERE id = ?
       LIMIT 1`,
      [result.insertId]
    );

    return { item: this.mapProduct(rows[0]) };
  }

  async updateProduct(productId: number, dto: UpdateJokerProductDto): Promise<{ item: JokerProduct }> {
    const existingRows = await this.databaseService.query<JokerProductRow[]>(
      `SELECT ${PRODUCT_COLUMNS}
       FROM saas_joker_products
       WHERE id = ?
       LIMIT 1`,
      [productId]
    );

    const existing = existingRows[0];
    if (!existing) {
      throw new NotFoundException("Producto no encontrado");
    }

    const nextName = dto.name?.trim() || existing.name;
    const nextCategory = dto.category?.trim() || existing.category;
    const nextPrice = dto.price ?? Number(existing.price);
    const nextSubcategory = dto.subcategory !== undefined ? dto.subcategory?.trim() || null : existing.subcategory;
    const nextSubcategoryDetail =
      dto.subcategoryDetail !== undefined ? dto.subcategoryDetail?.trim() || null : existing.subcategory_detail;
    const nextBrand = dto.brand !== undefined ? dto.brand?.trim() || null : existing.brand;
    const nextIngredients = dto.ingredients !== undefined ? dto.ingredients?.trim() || null : existing.ingredients;
    const nextObservations = dto.observations !== undefined ? dto.observations?.trim() || null : existing.observations;
    const nextProductType = dto.productType ?? existing.product_type;
    const nextStatus = dto.status ?? existing.status;
    const nextPricingUnit = dto.pricingUnit ?? existing.pricing_unit;

    await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_joker_products
       SET name = ?,
           category = ?,
           subcategory = ?,
           subcategory_detail = ?,
           brand = ?,
           price = ?,
           ingredients = ?,
           observations = ?,
           product_type = ?,
           status = ?,
           pricing_unit = ?
       WHERE id = ?`,
      [
        nextName,
        nextCategory,
        nextSubcategory,
        nextSubcategoryDetail,
        nextBrand,
        nextPrice,
        nextIngredients,
        nextObservations,
        nextProductType,
        nextStatus,
        nextPricingUnit,
        productId
      ]
    );

    const rows = await this.databaseService.query<JokerProductRow[]>(
      `SELECT ${PRODUCT_COLUMNS}
       FROM saas_joker_products
       WHERE id = ?
       LIMIT 1`,
      [productId]
    );

    return { item: this.mapProduct(rows[0]) };
  }

  async deleteProduct(productId: number): Promise<{ ok: true }> {
    const result = await this.databaseService.execute<ResultSetHeader>(
      `DELETE FROM saas_joker_products WHERE id = ?`,
      [productId]
    );

    if (result.affectedRows === 0) {
      throw new NotFoundException("Producto no encontrado");
    }

    return { ok: true };
  }

  async createOrder(dto: CreateJokerOrderDto): Promise<{ item: JokerOrder }> {
    const total = dto.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_joker_orders (total, address, payment_method, items) VALUES (?, ?, ?, ?)`,
      [total, dto.address?.trim() || "", dto.paymentMethod ?? "efectivo", JSON.stringify(dto.items)]
    );

    const rows = await this.databaseService.query<JokerOrderRow[]>(
      `SELECT ${ORDER_COLUMNS}
       FROM saas_joker_orders
       WHERE id = ?
       LIMIT 1`,
      [result.insertId]
    );

    return { item: this.mapOrder(rows[0]) };
  }

  async listOrders(dto: ListJokerOrdersDto): Promise<{ items: JokerOrder[] }> {
    const dateLabel = dto.date ? String(dto.date).slice(0, 10) : this.getStoreDateLabel();
    const { startIso, endIso } = this.buildStoreDayRangeUtc(dateLabel);

    const rows = await this.databaseService.query<JokerOrderRow[]>(
      `SELECT ${ORDER_COLUMNS}
       FROM saas_joker_orders
       WHERE created_at >= ? AND created_at < ?
       ORDER BY created_at DESC
       LIMIT 500`,
      [startIso, endIso]
    );

    return { items: rows.map((row) => this.mapOrder(row)) };
  }

  async deleteAllOrders(): Promise<{ ok: true }> {
    await this.databaseService.execute<ResultSetHeader>(`DELETE FROM saas_joker_orders`);
    return { ok: true };
  }

  async listClients(): Promise<{ items: JokerClient[] }> {
    const rows = await this.databaseService.query<JokerClientRow[]>(
      `SELECT id, name, phone, address, created_at
       FROM saas_joker_clients
       ORDER BY name ASC
       LIMIT 1000`
    );

    return { items: rows.map((row) => this.mapClient(row)) };
  }

  async createClient(dto: CreateJokerClientDto): Promise<{ item: JokerClient }> {
    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_joker_clients (name, phone, address) VALUES (?, ?, ?)`,
      [dto.name.trim(), dto.phone?.trim() || null, dto.address?.trim() || null]
    );

    const rows = await this.databaseService.query<JokerClientRow[]>(
      `SELECT id, name, phone, address, created_at FROM saas_joker_clients WHERE id = ? LIMIT 1`,
      [result.insertId]
    );

    return { item: this.mapClient(rows[0]) };
  }

  async deleteClient(clientId: number): Promise<{ ok: true }> {
    // El borrado de saas_joker_account_entries es en cascada (FK), no hace
    // falta borrarlos aparte.
    const result = await this.databaseService.execute<ResultSetHeader>(
      `DELETE FROM saas_joker_clients WHERE id = ?`,
      [clientId]
    );

    if (result.affectedRows === 0) {
      throw new NotFoundException("Cliente no encontrado");
    }

    return { ok: true };
  }

  async listAccountEntries(): Promise<{ items: JokerAccountEntry[] }> {
    const rows = await this.databaseService.query<JokerAccountEntryRow[]>(
      `SELECT id, client_id, total, items, created_at
       FROM saas_joker_account_entries
       ORDER BY created_at DESC
       LIMIT 2000`
    );

    return { items: rows.map((row) => this.mapAccountEntry(row)) };
  }

  async createAccountEntry(dto: CreateJokerAccountEntryDto): Promise<{ item: JokerAccountEntry }> {
    const clientRows = await this.databaseService.query<JokerClientRow[]>(
      `SELECT id, name, phone, address, created_at FROM saas_joker_clients WHERE id = ? LIMIT 1`,
      [dto.clientId]
    );

    if (!clientRows[0]) {
      throw new NotFoundException("Cliente no encontrado");
    }

    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_joker_account_entries (client_id, total, items) VALUES (?, ?, ?)`,
      [dto.clientId, dto.total, JSON.stringify(dto.items)]
    );

    const rows = await this.databaseService.query<JokerAccountEntryRow[]>(
      `SELECT id, client_id, total, items, created_at FROM saas_joker_account_entries WHERE id = ? LIMIT 1`,
      [result.insertId]
    );

    return { item: this.mapAccountEntry(rows[0]) };
  }

  // "Pago": salda la cuenta de un cliente puntual, sin borrar al cliente.
  async settleAccount(clientId: number): Promise<{ ok: true }> {
    await this.databaseService.execute<ResultSetHeader>(
      `DELETE FROM saas_joker_account_entries WHERE client_id = ?`,
      [clientId]
    );
    return { ok: true };
  }

  // Certificado publico + firma para que QZ Tray confie en el sitio sin
  // mostrar el cartel de "Signature (missing) / Validity (invalid)" en
  // cada conexion. QZ_CERTIFICATE y QZ_PRIVATE_KEY se generaron una sola
  // vez con openssl y se guardan como variables de entorno (el PEM con
  // los saltos de linea reemplazados por "\n" literal).
  getQzCertificate(): string {
    const certificate = process.env.QZ_CERTIFICATE;
    if (!certificate) {
      throw new BadRequestException("QZ_CERTIFICATE no esta configurado en el servidor.");
    }
    return certificate.replace(/\\n/g, "\n");
  }

  signQzRequest(toSign: string): { signature: string } {
    const privateKey = process.env.QZ_PRIVATE_KEY;
    if (!privateKey) {
      throw new BadRequestException("QZ_PRIVATE_KEY no esta configurado en el servidor.");
    }

    const sign = createSign("RSA-SHA512");
    sign.update(toSign);
    sign.end();
    const signature = sign.sign(privateKey.replace(/\\n/g, "\n"), "base64");

    return { signature };
  }

  private mapProduct(row: JokerProductRow): JokerProduct {
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      subcategory: row.subcategory,
      subcategoryDetail: row.subcategory_detail,
      brand: row.brand,
      price: Number(row.price),
      ingredients: row.ingredients,
      observations: row.observations,
      productType: row.product_type === "extra" ? "extra" : "simple",
      status: row.status === "draft" ? "draft" : "published",
      pricingUnit: row.pricing_unit === "kg" ? "kg" : "unidad",
      createdAt: this.toIsoString(row.created_at),
      updatedAt: this.toIsoString(row.updated_at)
    };
  }

  private mapOrder(row: JokerOrderRow): JokerOrder {
    return {
      id: row.id,
      total: Number(row.total),
      address: row.address,
      paymentMethod: this.toPaymentMethod(row.payment_method),
      items: typeof row.items === "string" ? JSON.parse(row.items) : row.items,
      createdAt: this.toIsoString(row.created_at)
    };
  }

  private mapClient(row: JokerClientRow): JokerClient {
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      address: row.address,
      createdAt: this.toIsoString(row.created_at)
    };
  }

  private mapAccountEntry(row: JokerAccountEntryRow): JokerAccountEntry {
    return {
      id: row.id,
      clientId: row.client_id,
      total: Number(row.total),
      items: typeof row.items === "string" ? JSON.parse(row.items) : row.items,
      createdAt: this.toIsoString(row.created_at)
    };
  }

  private toPaymentMethod(value: string): JokerPaymentMethod {
    return value === "tarjeta" || value === "transferencia" || value === "cuenta" ? value : "efectivo";
  }

  private getStoreDateLabel(date = new Date()) {
    const shifted = new Date(date.getTime() - STORE_DAY_START_HOUR * 60 * 60 * 1000);
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Montevideo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(shifted);
  }

  private buildStoreDayRangeUtc(dateLabel: string) {
    const match = String(dateLabel || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      throw new BadRequestException("La fecha debe tener formato YYYY-MM-DD.");
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const start = new Date(Date.UTC(year, month - 1, day, STORE_UTC_OFFSET_HOURS + STORE_DAY_START_HOUR, 0, 0));
    const end = new Date(Date.UTC(year, month - 1, day + 1, STORE_UTC_OFFSET_HOURS + STORE_DAY_START_HOUR, 0, 0));

    return {
      startIso: start.toISOString().slice(0, 19).replace("T", " "),
      endIso: end.toISOString().slice(0, 19).replace("T", " ")
    };
  }

  private toIsoString(value: string | Date) {
    return value instanceof Date ? value.toISOString() : value;
  }
}
