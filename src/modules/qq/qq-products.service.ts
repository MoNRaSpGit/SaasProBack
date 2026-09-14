import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
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
  has_image: number;
  category: string | null;
  status: "published" | "draft";
  created_at: string;
};

type QqProductImageRow = RowDataPacket & {
  image_data: Buffer;
  mime_type: string;
  source_hash: string;
};

// created_at se trae siempre con DATE_FORMAT (nunca la columna DATETIME
// cruda) para que mysql2 lo devuelva como string tal cual, sin que el
// driver lo reinterprete como UTC con la timezone del proceso de Node --
// mismo criterio ya usado en delivery.service.ts.
const PRODUCT_COLUMNS = `
  id, name, description, price, currency,
  image_url, has_image, category, status,
  DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%S') AS created_at
`;

// data:<mime>;base64,<payload> -- lo que manda el frontend despues de
// redimensionar/comprimir la imagen con canvas (ver
// ProductFormModal#resizeImageFile). Mismo criterio que frontend-piloto.
function parseImageDataUri(value: string): { mimeType: string; buffer: Buffer } | null {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(value.trim());
  if (!match) return null;
  return { mimeType: match[1], buffer: Buffer.from(match[2], "base64") };
}

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

  // Imagen del producto: se guarda en saas_qq_product_images (binario, no
  // base64) y se sirve por separado via GET /qq/products/:id/image, con
  // cache headers (ver qq.controller.ts). Devuelve null si el producto no
  // tiene imagen o el hash no coincide con el guardado (invalida cache
  // del lado del cliente).
  async getProductImage(productId: number): Promise<{ buffer: Buffer; mimeType: string; sourceHash: string } | null> {
    const rows = await this.databaseService.query<QqProductImageRow[]>(
      `SELECT image_data, mime_type, source_hash FROM saas_qq_product_images WHERE product_id = ? LIMIT 1`,
      [productId]
    );
    if (!rows[0]) return null;
    return { buffer: rows[0].image_data, mimeType: rows[0].mime_type, sourceHash: rows[0].source_hash };
  }

  // Acepta un data URI base64 -- el frontend ya la redimensiono/comprimio
  // ANTES de mandarla (canvas del lado del cliente), asi que lo que llega
  // aca ya es "prudente" en tamaño, esto no hace ningun procesamiento.
  async setProductImage(productId: number, dataUri: string): Promise<{ item: QqProduct }> {
    const parsed = parseImageDataUri(dataUri);
    if (!parsed) {
      throw new BadRequestException("La imagen debe ser un data URI base64 válido.");
    }

    const sourceHash = createHash("sha256").update(parsed.buffer).digest("hex");

    await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_qq_product_images (product_id, image_data, mime_type, source_hash, byte_size)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         image_data = VALUES(image_data),
         mime_type = VALUES(mime_type),
         source_hash = VALUES(source_hash),
         byte_size = VALUES(byte_size)`,
      [productId, parsed.buffer, parsed.mimeType, sourceHash, parsed.buffer.length]
    );

    await this.databaseService.execute<ResultSetHeader>(`UPDATE saas_qq_products SET has_image = 1 WHERE id = ?`, [
      productId
    ]);

    return this.getProductOrThrow(productId);
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
      hasImage: Boolean(row.has_image),
      category: row.category,
      status: row.status,
      createdAt: row.created_at
    };
  }
}
