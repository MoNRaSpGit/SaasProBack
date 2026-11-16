import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CreateRopaProductDto } from "./dto/create-ropa-product.dto";
import { UpdateRopaProductDto } from "./dto/update-ropa-product.dto";
import { RopaProduct } from "./ropa.types";

type RopaProductRow = RowDataPacket & {
  id: number;
  name: string;
  description: string | null;
  price: string | number;
  sizes: string | null;
  currency: string;
  image_url: string | null;
  has_image: number;
  category: string | null;
  status: "published" | "draft";
  sort_order: number;
  created_at: string;
};

type RopaProductImageRow = RowDataPacket & {
  image_data: Buffer;
  mime_type: string;
  source_hash: string;
};

// created_at se trae siempre con DATE_FORMAT (nunca la columna DATETIME
// cruda) para que mysql2 lo devuelva como string tal cual, sin que el
// driver lo reinterprete como UTC con la timezone del proceso de Node --
// mismo criterio ya usado en delivery.service.ts.
const PRODUCT_COLUMNS = `
  id, name, description, price, sizes, currency,
  image_url, has_image, category, status, sort_order,
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
export class RopaProductsService {
  constructor(private readonly databaseService: DatabaseService) {}

  // Buscador "estilo Netflix": si no viene texto, trae todo lo publicado;
  // si viene, filtra por nombre (contiene, sin distinguir mayusculas).
  // Ordenado por sort_order (16/09/2026, orden manual del admin), no por
  // fecha -- el catalogo publico respeta el orden que se ve en
  // "Productos".
  async listProducts(search?: string): Promise<{ items: RopaProduct[] }> {
    const trimmedSearch = search?.trim();

    const rows = trimmedSearch
      ? await this.databaseService.query<RopaProductRow[]>(
          `SELECT ${PRODUCT_COLUMNS} FROM saas_ropa_products WHERE status = 'published' AND name LIKE ? ORDER BY sort_order ASC LIMIT 200`,
          [`%${trimmedSearch}%`]
        )
      : await this.databaseService.query<RopaProductRow[]>(
          `SELECT ${PRODUCT_COLUMNS} FROM saas_ropa_products WHERE status = 'published' ORDER BY sort_order ASC LIMIT 200`
        );

    return { items: rows.map((row) => this.mapProduct(row)) };
  }

  async createProduct(dto: CreateRopaProductDto): Promise<{ item: RopaProduct }> {
    // Se agrega siempre al final (mismo criterio que el carrusel).
    const [{ nextOrder }] = await this.databaseService.query<Array<RowDataPacket & { nextOrder: number }>>(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 AS nextOrder FROM saas_ropa_products`
    );

    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_ropa_products (name, description, price, sizes, currency, image_url, category, status, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dto.name.trim(),
        dto.description?.trim() || null,
        dto.price,
        this.serializeSizes(dto.sizes),
        dto.currency ?? "UYU",
        dto.imageUrl?.trim() || null,
        dto.category?.trim() || null,
        dto.status ?? "published",
        nextOrder
      ]
    );

    return this.getProductOrThrow(result.insertId);
  }

  // Reordenar (16/09/2026): "si la cambio al puesto numero 1, la 1
  // pasaria al puesto de la que cambie" -- swap simple entre la tarjeta
  // movida y la que ya estaba ocupando ese puesto (si hay alguna).
  async reorderProduct(productId: number, newPosition: number): Promise<{ item: RopaProduct }> {
    const rows = await this.databaseService.query<RopaProductRow[]>(
      `SELECT ${PRODUCT_COLUMNS} FROM saas_ropa_products WHERE id = ? LIMIT 1`,
      [productId]
    );
    const product = rows[0];
    if (!product) {
      throw new NotFoundException("Producto no encontrado");
    }

    if (newPosition === product.sort_order) {
      return { item: this.mapProduct(product) };
    }

    const swapRows = await this.databaseService.query<RopaProductRow[]>(
      `SELECT id FROM saas_ropa_products WHERE sort_order = ? AND id != ? LIMIT 1`,
      [newPosition, productId]
    );
    const swapWith = swapRows[0];

    if (swapWith) {
      await this.databaseService.execute<ResultSetHeader>(`UPDATE saas_ropa_products SET sort_order = ? WHERE id = ?`, [
        product.sort_order,
        swapWith.id
      ]);
    }

    await this.databaseService.execute<ResultSetHeader>(`UPDATE saas_ropa_products SET sort_order = ? WHERE id = ?`, [
      newPosition,
      productId
    ]);

    return this.getProductOrThrow(productId);
  }

  async updateProduct(productId: number, dto: UpdateRopaProductDto): Promise<{ item: RopaProduct }> {
    const existingRows = await this.databaseService.query<RopaProductRow[]>(
      `SELECT ${PRODUCT_COLUMNS} FROM saas_ropa_products WHERE id = ? LIMIT 1`,
      [productId]
    );
    const existing = existingRows[0];
    if (!existing) {
      throw new NotFoundException("Producto no encontrado");
    }

    await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_ropa_products SET name = ?, description = ?, price = ?, sizes = ?, currency = ?, image_url = ?, category = ?, status = ? WHERE id = ?`,
      [
        dto.name?.trim() ?? existing.name,
        dto.description !== undefined ? dto.description.trim() || null : existing.description,
        dto.price !== undefined ? dto.price : existing.price,
        dto.sizes !== undefined ? this.serializeSizes(dto.sizes) : existing.sizes,
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
    const result = await this.databaseService.execute<ResultSetHeader>(`DELETE FROM saas_ropa_products WHERE id = ?`, [
      productId
    ]);
    if (result.affectedRows === 0) {
      throw new NotFoundException("Producto no encontrado");
    }
    return { ok: true };
  }

  // Imagen del producto: se guarda en saas_ropa_product_images (binario, no
  // base64) y se sirve por separado via GET /ropa/products/:id/image, con
  // cache headers (ver ropa.controller.ts). Devuelve null si el producto no
  // tiene imagen o el hash no coincide con el guardado (invalida cache
  // del lado del cliente).
  async getProductImage(productId: number): Promise<{ buffer: Buffer; mimeType: string; sourceHash: string } | null> {
    const rows = await this.databaseService.query<RopaProductImageRow[]>(
      `SELECT image_data, mime_type, source_hash FROM saas_ropa_product_images WHERE product_id = ? LIMIT 1`,
      [productId]
    );
    if (!rows[0]) return null;
    return { buffer: rows[0].image_data, mimeType: rows[0].mime_type, sourceHash: rows[0].source_hash };
  }

  // Acepta un data URI base64 -- el frontend ya la redimensiono/comprimio
  // ANTES de mandarla (canvas del lado del cliente), asi que lo que llega
  // aca ya es "prudente" en tamaño, esto no hace ningun procesamiento.
  async setProductImage(productId: number, dataUri: string): Promise<{ item: RopaProduct }> {
    const parsed = parseImageDataUri(dataUri);
    if (!parsed) {
      throw new BadRequestException("La imagen debe ser un data URI base64 válido.");
    }

    const sourceHash = createHash("sha256").update(parsed.buffer).digest("hex");

    await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_ropa_product_images (product_id, image_data, mime_type, source_hash, byte_size)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         image_data = VALUES(image_data),
         mime_type = VALUES(mime_type),
         source_hash = VALUES(source_hash),
         byte_size = VALUES(byte_size)`,
      [productId, parsed.buffer, parsed.mimeType, sourceHash, parsed.buffer.length]
    );

    await this.databaseService.execute<ResultSetHeader>(`UPDATE saas_ropa_products SET has_image = 1 WHERE id = ?`, [
      productId
    ]);

    return this.getProductOrThrow(productId);
  }

  // Publico (no private) para que el controller pueda tomar el "antes" de
  // una edicion/borrado y dejarlo en el registro de auditoria.
  async getProductOrThrow(productId: number): Promise<{ item: RopaProduct }> {
    const rows = await this.databaseService.query<RopaProductRow[]>(
      `SELECT ${PRODUCT_COLUMNS} FROM saas_ropa_products WHERE id = ? LIMIT 1`,
      [productId]
    );
    const row = rows[0];
    if (!row) {
      throw new NotFoundException("Producto no encontrado");
    }
    return { item: this.mapProduct(row) };
  }

  // Talles guardados como texto separado por comas ("S,M,L"); null = sin talles.
  private serializeSizes(sizes?: string[]): string | null {
    const clean = Array.from(new Set((sizes ?? []).map((size) => size.trim().toUpperCase().replace(/,/g, "")).filter(Boolean)));
    return clean.length ? clean.join(",") : null;
  }

  private mapProduct(row: RopaProductRow): RopaProduct {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      price: Number(row.price),
      sizes: row.sizes ? row.sizes.split(",").filter(Boolean) : [],
      currency: row.currency,
      imageUrl: row.image_url,
      hasImage: Boolean(row.has_image),
      category: row.category,
      status: row.status,
      position: row.sort_order,
      createdAt: row.created_at
    };
  }
}
