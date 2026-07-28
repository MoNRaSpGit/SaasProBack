import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CreateJokerOrderDto } from "./dto/create-joker-order.dto";
import { CreateJokerProductDto } from "./dto/create-joker-product.dto";
import { ListJokerOrdersDto } from "./dto/list-joker-orders.dto";
import { UpdateJokerProductDto } from "./dto/update-joker-product.dto";
import { JokerOrder, JokerProduct } from "./joker.types";

type JokerProductRow = RowDataPacket & {
  id: number;
  name: string;
  category: string;
  price: string | number;
  created_at: string | Date;
  updated_at: string | Date;
};

type JokerOrderRow = RowDataPacket & {
  id: number;
  total: string | number;
  address: string;
  items: string;
  created_at: string | Date;
};

const PRODUCT_COLUMNS = `
  id,
  name,
  category,
  price,
  created_at,
  updated_at
`;

const ORDER_COLUMNS = `
  id,
  total,
  address,
  items,
  created_at
`;

// El local (El Joker) opera en Montevideo (UTC-3); el "dia" del panel
// arranca y cierra a medianoche hora local, no UTC.
const STORE_UTC_OFFSET_HOURS = 3;

@Injectable()
export class JokerService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listProducts(): Promise<{ items: JokerProduct[] }> {
    const rows = await this.databaseService.query<JokerProductRow[]>(
      `SELECT ${PRODUCT_COLUMNS}
       FROM saas_joker_products
       ORDER BY category ASC, name ASC
       LIMIT 200`
    );

    return { items: rows.map((row) => this.mapProduct(row)) };
  }

  async createProduct(dto: CreateJokerProductDto): Promise<{ item: JokerProduct }> {
    const name = dto.name.trim();
    const category = dto.category?.trim() || "Otros";

    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_joker_products (name, category, price) VALUES (?, ?, ?)`,
      [name, category, dto.price]
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

    await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_joker_products
       SET name = ?,
           category = ?,
           price = ?
       WHERE id = ?`,
      [nextName, nextCategory, nextPrice, productId]
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
      `INSERT INTO saas_joker_orders (total, address, items) VALUES (?, ?, ?)`,
      [total, dto.address?.trim() || "", JSON.stringify(dto.items)]
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

  private mapProduct(row: JokerProductRow): JokerProduct {
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      price: Number(row.price),
      createdAt: this.toIsoString(row.created_at),
      updatedAt: this.toIsoString(row.updated_at)
    };
  }

  private mapOrder(row: JokerOrderRow): JokerOrder {
    return {
      id: row.id,
      total: Number(row.total),
      address: row.address,
      items: typeof row.items === "string" ? JSON.parse(row.items) : row.items,
      createdAt: this.toIsoString(row.created_at)
    };
  }

  private getStoreDateLabel(date = new Date()) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Montevideo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date);
  }

  private buildStoreDayRangeUtc(dateLabel: string) {
    const match = String(dateLabel || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      throw new BadRequestException("La fecha debe tener formato YYYY-MM-DD.");
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const start = new Date(Date.UTC(year, month - 1, day, STORE_UTC_OFFSET_HOURS, 0, 0));
    const end = new Date(Date.UTC(year, month - 1, day + 1, STORE_UTC_OFFSET_HOURS, 0, 0));

    return {
      startIso: start.toISOString().slice(0, 19).replace("T", " "),
      endIso: end.toISOString().slice(0, 19).replace("T", " ")
    };
  }

  private toIsoString(value: string | Date) {
    return value instanceof Date ? value.toISOString() : value;
  }
}
