import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { CloudinaryService } from "../../shared/cloudinary/cloudinary.service";
import { DatabaseService } from "../../shared/database/database.service";
import { CreateQqProductDto } from "./dto/create-qq-product.dto";
import { UpdateQqProductDto } from "./dto/update-qq-product.dto";
import { QqProduct } from "./qq.types";

type QqProductRow = RowDataPacket & {
  id: number;
  name: string;
  description: string | null;
  account_price: string | number | null;
  profile_price: string | number | null;
  currency: string;
  billing_type: "monthly" | "one_time";
  image_url: string | null;
  has_image: number;
  category: string | null;
  status: "published" | "draft";
  sort_order: number;
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
  id, name, description, account_price, profile_price, currency, billing_type,
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

type GalleryRow = RowDataPacket & { id: number; product_id: number; image_url: string; public_id: string };

// Fotos extra por producto (17/11/2026): la principal + hasta 5 mas.
export const MAX_GALLERY_IMAGES = 5;

@Injectable()
export class QqProductsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly cloudinaryService: CloudinaryService
  ) {}

  // Buscador "estilo Netflix": si no viene texto, trae todo lo publicado;
  // si viene, filtra por nombre (contiene, sin distinguir mayusculas).
  // Ordenado por sort_order (16/09/2026, orden manual del admin), no por
  // fecha -- el catalogo publico respeta el orden que se ve en
  // "Productos".
  async listProducts(search?: string): Promise<{ items: QqProduct[] }> {
    const trimmedSearch = search?.trim();

    const rows = trimmedSearch
      ? await this.databaseService.query<QqProductRow[]>(
          `SELECT ${PRODUCT_COLUMNS} FROM saas_qq_products WHERE status = 'published' AND name LIKE ? ORDER BY sort_order ASC LIMIT 200`,
          [`%${trimmedSearch}%`]
        )
      : await this.databaseService.query<QqProductRow[]>(
          `SELECT ${PRODUCT_COLUMNS} FROM saas_qq_products WHERE status = 'published' ORDER BY sort_order ASC LIMIT 200`
        );

    return { items: await this.attachGallery(rows.map((row) => this.mapProduct(row))) };
  }

  async createProduct(dto: CreateQqProductDto): Promise<{ item: QqProduct }> {
    // 17/11/2026: el precio es opcional (hay productos que no llevan precio: se
    // muestra "Consultar"). Ya no se exige ninguno de los dos.

    // Se agrega siempre al final (mismo criterio que el carrusel).
    const [{ nextOrder }] = await this.databaseService.query<Array<RowDataPacket & { nextOrder: number }>>(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 AS nextOrder FROM saas_qq_products`
    );

    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_qq_products (name, description, account_price, profile_price, currency, billing_type, image_url, category, status, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dto.name.trim(),
        dto.description?.trim() || null,
        dto.accountPrice ?? null,
        dto.profilePrice ?? null,
        dto.currency ?? "UYU",
        dto.billingType ?? "monthly",
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
  async reorderProduct(productId: number, newPosition: number): Promise<{ item: QqProduct }> {
    const rows = await this.databaseService.query<QqProductRow[]>(
      `SELECT ${PRODUCT_COLUMNS} FROM saas_qq_products WHERE id = ? LIMIT 1`,
      [productId]
    );
    const product = rows[0];
    if (!product) {
      throw new NotFoundException("Producto no encontrado");
    }

    if (newPosition === product.sort_order) {
      return this.getProductOrThrow(productId);
    }

    const swapRows = await this.databaseService.query<QqProductRow[]>(
      `SELECT id FROM saas_qq_products WHERE sort_order = ? AND id != ? LIMIT 1`,
      [newPosition, productId]
    );
    const swapWith = swapRows[0];

    if (swapWith) {
      await this.databaseService.execute<ResultSetHeader>(`UPDATE saas_qq_products SET sort_order = ? WHERE id = ?`, [
        product.sort_order,
        swapWith.id
      ]);
    }

    await this.databaseService.execute<ResultSetHeader>(`UPDATE saas_qq_products SET sort_order = ? WHERE id = ?`, [
      newPosition,
      productId
    ]);

    return this.getProductOrThrow(productId);
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

    const nextAccountPrice = dto.accountPrice !== undefined ? dto.accountPrice : existing.account_price;
    const nextProfilePrice = dto.profilePrice !== undefined ? dto.profilePrice : existing.profile_price;

    await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_qq_products SET name = ?, description = ?, account_price = ?, profile_price = ?, currency = ?, billing_type = ?, image_url = ?, category = ?, status = ? WHERE id = ?`,
      [
        dto.name?.trim() ?? existing.name,
        dto.description !== undefined ? dto.description.trim() || null : existing.description,
        nextAccountPrice,
        nextProfilePrice,
        dto.currency ?? existing.currency,
        dto.billingType ?? existing.billing_type,
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
    // Las fotos extra (galeria) tambien se borran, de la base y de Cloudinary.
    const galleryRows = await this.databaseService.query<GalleryRow[]>(
      `SELECT id, product_id, image_url, public_id FROM saas_qq_product_gallery WHERE product_id = ?`,
      [productId]
    );
    await this.databaseService.execute(`DELETE FROM saas_qq_product_gallery WHERE product_id = ?`, [productId]);
    if (this.cloudinaryService.isConfigured()) {
      for (const row of galleryRows) await this.cloudinaryService.deleteByPublicId(row.public_id).catch(() => undefined);
    }
    // Tambien se borra la foto de Cloudinary (si no estaba, no pasa nada).
    if (this.cloudinaryService.isConfigured()) {
      await this.cloudinaryService.deleteByPublicId(`qq/products/product-${productId}`).catch(() => undefined);
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

    // 17/11/2026: la foto va a Cloudinary y en la base queda solo el link
    // (columna image_url). has_image en 0 = el frontend usa el link directo.
    if (this.cloudinaryService.isConfigured()) {
      const upload = await this.cloudinaryService.uploadBuffer(parsed.buffer, "qq/products", `product-${productId}`);
      await this.databaseService.execute<ResultSetHeader>(`UPDATE saas_qq_products SET image_url = ?, has_image = 0 WHERE id = ?`, [
        this.cloudinaryService.optimizedUrl(upload.url),
        productId
      ]);
      await this.databaseService.execute<ResultSetHeader>(`DELETE FROM saas_qq_product_images WHERE product_id = ?`, [productId]);
      return this.getProductOrThrow(productId);
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

  // Agrega las fotos extra a cada producto con UNA sola consulta.
  private async attachGallery(items: QqProduct[]): Promise<QqProduct[]> {
    if (items.length === 0) return items;
    const rows = await this.databaseService.query<GalleryRow[]>(
      `SELECT id, product_id, image_url, public_id FROM saas_qq_product_gallery
       WHERE product_id IN (${items.map(() => "?").join(",")}) ORDER BY sort_order ASC, id ASC`,
      items.map((item) => item.id)
    );
    const byProduct = new Map<number, Array<{ id: number; url: string }>>();
    for (const row of rows) {
      const list = byProduct.get(Number(row.product_id)) ?? [];
      list.push({ id: row.id, url: row.image_url });
      byProduct.set(Number(row.product_id), list);
    }
    return items.map((item) => ({ ...item, gallery: byProduct.get(item.id) ?? [] }));
  }

  // Suma una foto extra al producto (otro angulo). Va a Cloudinary; en la base
  // solo queda el link. Tope: MAX_GALLERY_IMAGES.
  async addGalleryImage(productId: number, dataUri: string): Promise<{ item: QqProduct }> {
    await this.getProductOrThrow(productId);
    const parsed = parseImageDataUri(dataUri);
    if (!parsed) {
      throw new BadRequestException("La imagen debe ser un data URI base64 válido.");
    }
    if (!/^image\/(jpeg|png|webp)$/.test(parsed.mimeType)) {
      throw new BadRequestException("Solo se aceptan imágenes JPG, PNG o WEBP.");
    }
    if (!this.cloudinaryService.isConfigured()) {
      throw new BadRequestException("Las fotos extra todavía no están disponibles.");
    }
    const [{ total, nextOrder }] = await this.databaseService.query<Array<RowDataPacket & { total: number; nextOrder: number }>>(
      `SELECT COUNT(*) AS total, COALESCE(MAX(sort_order), -1) + 1 AS nextOrder FROM saas_qq_product_gallery WHERE product_id = ?`,
      [productId]
    );
    if (Number(total) >= MAX_GALLERY_IMAGES) {
      throw new BadRequestException(`Cada producto puede tener hasta ${MAX_GALLERY_IMAGES} fotos extra. Borrá alguna para agregar otra.`);
    }

    const upload = await this.cloudinaryService.uploadBuffer(parsed.buffer, "qq/gallery", `gallery-${productId}-${randomBytes(5).toString("hex")}`);
    await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_qq_product_gallery (product_id, image_url, public_id, sort_order) VALUES (?, ?, ?, ?)`,
      [productId, this.cloudinaryService.optimizedUrl(upload.url), upload.publicId, Number(nextOrder)]
    );
    return this.getProductOrThrow(productId);
  }

  async deleteGalleryImage(productId: number, imageId: number): Promise<{ item: QqProduct }> {
    const rows = await this.databaseService.query<GalleryRow[]>(
      `SELECT id, product_id, image_url, public_id FROM saas_qq_product_gallery WHERE id = ? AND product_id = ? LIMIT 1`,
      [imageId, productId]
    );
    if (!rows[0]) {
      throw new NotFoundException("Foto no encontrada");
    }
    await this.databaseService.execute(`DELETE FROM saas_qq_product_gallery WHERE id = ?`, [imageId]);
    if (this.cloudinaryService.isConfigured()) {
      await this.cloudinaryService.deleteByPublicId(rows[0].public_id).catch(() => undefined);
    }
    return this.getProductOrThrow(productId);
  }

  // Publico (no private) para que el controller pueda tomar el "antes" de
  // una edicion/borrado y dejarlo en el registro de auditoria.
  async getProductOrThrow(productId: number): Promise<{ item: QqProduct }> {
    const rows = await this.databaseService.query<QqProductRow[]>(
      `SELECT ${PRODUCT_COLUMNS} FROM saas_qq_products WHERE id = ? LIMIT 1`,
      [productId]
    );
    const row = rows[0];
    if (!row) {
      throw new NotFoundException("Producto no encontrado");
    }
    const [item] = await this.attachGallery([this.mapProduct(row)]);
    return { item };
  }

  private mapProduct(row: QqProductRow): QqProduct {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      accountPrice: row.account_price === null ? null : Number(row.account_price),
      profilePrice: row.profile_price === null ? null : Number(row.profile_price),
      currency: row.currency,
      billingType: row.billing_type,
      imageUrl: row.image_url,
      hasImage: Boolean(row.has_image),
      category: row.category,
      status: row.status,
      gallery: [],
      position: row.sort_order,
      createdAt: row.created_at
    };
  }
}
