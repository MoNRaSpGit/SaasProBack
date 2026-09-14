import { Injectable, NotFoundException } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CreateQqProductDto } from "./dto/create-qq-product.dto";
import { UpdateQqProductDto } from "./dto/update-qq-product.dto";
import { QqProduct } from "./qq.types";

type QqProductRow = RowDataPacket & {
  id: number;
  name: string;
  description: string | null;
  price: string | number;
  currency: string;
  image_url: string | null;
  category: string | null;
  status: "published" | "draft";
  created_at: string;
};

// created_at se trae siempre con DATE_FORMAT (nunca la columna DATETIME
// cruda) para que mysql2 lo devuelva como string tal cual, sin que el
// driver lo reinterprete como UTC con la timezone del proceso de Node --
// mismo criterio ya usado en delivery.service.ts.
const PRODUCT_COLUMNS = `
  id, name, description, price, currency,
  image_url, category, status,
  DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%S') AS created_at
`;

@Injectable()
export class QqProductsService {
  constructor(private readonly databaseService: DatabaseService) {}

  // Buscador "estilo Netflix": si no viene texto, trae todo lo publicado;
  // si viene, filtra por nombre (contiene, sin distinguir mayusculas).
  async listProducts(search?: string): Promise<{ items: QqProduct[] }> {
    const trimmedSearch = search?.trim();

    const rows = trimmedSearch
      ? await this.databaseService.query<QqProductRow[]>(
          `SELECT ${PRODUCT_COLUMNS} FROM saas_qq_products WHERE status = 'published' AND name LIKE ? ORDER BY created_at DESC LIMIT 200`,
          [`%${trimmedSearch}%`]
        )
      : await this.databaseService.query<QqProductRow[]>(
          `SELECT ${PRODUCT_COLUMNS} FROM saas_qq_products WHERE status = 'published' ORDER BY created_at DESC LIMIT 200`
        );

    return { items: rows.map((row) => this.mapProduct(row)) };
  }

  async createProduct(dto: CreateQqProductDto): Promise<{ item: QqProduct }> {
    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_qq_products (name, description, price, currency, image_url, category, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        dto.name.trim(),
        dto.description?.trim() || null,
        dto.price,
        dto.currency ?? "UYU",
        dto.imageUrl?.trim() || null,
        dto.category?.trim() || null,
        dto.status ?? "published"
      ]
    );

    return this.getProductOrThrow(result.insertId);
  }

  async updateProduct(productId: number, dto: UpdateQqProductDto): Promise<{ item: QqProduct }> {
    const existingRows = await this.databaseService.query<QqProductRow[]>(
      `SELECT ${PRODUCT_COLUMNS} FROM saas_qq_products WHERE id = ? LIMIT 1`,
      [productId]
    );
    const existing = existingRows[0];
    if (!existing) {
      throw new NotFoundException("Producto no encontrado");
    }

    await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_qq_products SET name = ?, description = ?, price = ?, currency = ?, image_url = ?, category = ?, status = ? WHERE id = ?`,
      [
        dto.name?.trim() ?? existing.name,
        dto.description !== undefined ? dto.description.trim() || null : existing.description,
        dto.price ?? existing.price,
        dto.currency ?? existing.currency,
        dto.imageUrl !== undefined ? dto.imageUrl.trim() || null : existing.image_url,
        dto.category !== undefined ? dto.category.trim() || null : existing.category,
        dto.status ?? existing.status,
        productId
      ]
    );

    return this.getProductOrThrow(productId);
  }

  async deleteProduct(productId: number): Promise<{ ok: true }> {
    const result = await this.databaseService.execute<ResultSetHeader>(`DELETE FROM saas_qq_products WHERE id = ?`, [
      productId
    ]);
    if (result.affectedRows === 0) {
      throw new NotFoundException("Producto no encontrado");
    }
    return { ok: true };
  }

  private async getProductOrThrow(productId: number): Promise<{ item: QqProduct }> {
    const rows = await this.databaseService.query<QqProductRow[]>(
      `SELECT ${PRODUCT_COLUMNS} FROM saas_qq_products WHERE id = ? LIMIT 1`,
      [productId]
    );
    const row = rows[0];
    if (!row) {
      throw new NotFoundException("Producto no encontrado");
    }
    return { item: this.mapProduct(row) };
  }

  private mapProduct(row: QqProductRow): QqProduct {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      price: Number(row.price),
      currency: row.currency,
      imageUrl: row.image_url,
      category: row.category,
      status: row.status,
      createdAt: row.created_at
    };
  }
}
