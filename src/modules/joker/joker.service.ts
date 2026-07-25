import { Injectable, NotFoundException } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CreateJokerProductDto } from "./dto/create-joker-product.dto";
import { UpdateJokerProductDto } from "./dto/update-joker-product.dto";
import { UpdateJokerSettingsDto } from "./dto/update-joker-settings.dto";
import { JokerProduct, JokerSettings } from "./joker.types";

type JokerProductRow = RowDataPacket & {
  id: number;
  name: string;
  category: string;
  price: string | number;
  created_at: string | Date;
  updated_at: string | Date;
};

type JokerSettingsRow = RowDataPacket & {
  store_name: string;
  address: string;
  phone: string;
};

const PRODUCT_COLUMNS = `
  id,
  name,
  category,
  price,
  created_at,
  updated_at
`;

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

  async getSettings(): Promise<{ item: JokerSettings }> {
    const rows = await this.databaseService.query<JokerSettingsRow[]>(
      `SELECT store_name, address, phone FROM saas_joker_settings WHERE id = 1 LIMIT 1`
    );

    const row = rows[0];
    return {
      item: {
        storeName: row?.store_name ?? "EL JOKER",
        address: row?.address ?? "",
        phone: row?.phone ?? ""
      }
    };
  }

  async updateSettings(dto: UpdateJokerSettingsDto): Promise<{ item: JokerSettings }> {
    const current = await this.getSettings();

    const nextStoreName = dto.storeName?.trim() || current.item.storeName;
    const nextAddress = dto.address?.trim() ?? current.item.address;
    const nextPhone = dto.phone?.trim() ?? current.item.phone;

    await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_joker_settings
       SET store_name = ?,
           address = ?,
           phone = ?
       WHERE id = 1`,
      [nextStoreName, nextAddress, nextPhone]
    );

    return { item: { storeName: nextStoreName, address: nextAddress, phone: nextPhone } };
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

  private toIsoString(value: string | Date) {
    return value instanceof Date ? value.toISOString() : value;
  }
}
