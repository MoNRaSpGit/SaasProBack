import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "crypto";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CreatePilotoProductDto } from "./dto/create-piloto-product.dto";
import { CreatePilotoSaleDto } from "./dto/create-piloto-sale.dto";
import { UpdatePilotoProductDto } from "./dto/update-piloto-product.dto";
import { PilotoProduct, PilotoSale } from "./piloto.types";

type PilotoProductRow = RowDataPacket & {
  id: number;
  name: string;
  barcode: string;
  price: string | number;
  stock: string | number;
  has_image: number;
  status: "active" | "inactive";
  created_at: string | Date;
  updated_at: string | Date;
};

type PilotoProductImageRow = RowDataPacket & {
  image_data: Buffer;
  mime_type: string;
  source_hash: string;
};

// La imagen NO va en esta tabla: se guarda aparte, en binario, en
// saas_piloto_product_images (ver getProductImage/setProductImage). Traer
// el binario en cada SELECT de productos (como se hacia antes con
// image_url en base64) hacia lento cualquier busqueda o listado.
const PRODUCT_COLUMNS = `
  id,
  name,
  barcode,
  price,
  stock,
  has_image,
  status,
  created_at,
  updated_at
`;

// data:<mime>;base64,<payload> -- formato que mandaba el frontend viejo (y
// el que se sigue aceptando por compatibilidad si algun script externo lo
// manda asi).
function parseImageDataUri(value: string): { mimeType: string; buffer: Buffer } | null {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(value.trim());
  if (!match) return null;
  return { mimeType: match[1], buffer: Buffer.from(match[2], "base64") };
}

function normalizeBarcode(value: string) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "");
}

type CachedProductLookup = {
  cachedAt: number;
  product: PilotoProduct;
};

const PRODUCT_LOOKUP_CACHE_TTL_MS = 1000 * 60 * 10;
const PRODUCT_LOOKUP_CACHE_MAX_ENTRIES = 1000;
// Deshabilitado temporalmente: sospecha de que estaba causando errores al
// editar muchos productos seguidos. Volver a poner en true para reactivarlo.
const PRODUCT_LOOKUP_CACHE_ENABLED = false;

@Injectable()
export class PilotoService {
  private readonly productLookupCache = new Map<string, CachedProductLookup>();

  constructor(private readonly databaseService: DatabaseService) {}

  async findByBarcode(barcode: string): Promise<{ item: PilotoProduct }> {
    const normalizedBarcode = normalizeBarcode(barcode);
    if (!normalizedBarcode) {
      throw new BadRequestException("Codigo de barras invalido");
    }

    if (PRODUCT_LOOKUP_CACHE_ENABLED) {
      const cachedEntry = this.productLookupCache.get(normalizedBarcode);
      if (cachedEntry) {
        if (Date.now() - cachedEntry.cachedAt <= PRODUCT_LOOKUP_CACHE_TTL_MS) {
          return { item: cachedEntry.product };
        }
        this.productLookupCache.delete(normalizedBarcode);
      }
    }

    const rows = await this.databaseService.query<PilotoProductRow[]>(
      `SELECT ${PRODUCT_COLUMNS}
       FROM saas_piloto_products
       WHERE barcode_normalized = ?
       LIMIT 1`,
      [normalizedBarcode]
    );

    if (!rows[0]) {
      throw new NotFoundException("Producto no encontrado");
    }

    const product = this.mapProduct(rows[0]);
    if (PRODUCT_LOOKUP_CACHE_ENABLED) {
      this.setProductLookupCache(normalizedBarcode, product);
    }
    return { item: product };
  }

  resetProductLookupCache() {
    this.productLookupCache.clear();
    return { ok: true };
  }

  private setProductLookupCache(normalizedBarcode: string, product: PilotoProduct) {
    this.productLookupCache.set(normalizedBarcode, { cachedAt: Date.now(), product });

    if (this.productLookupCache.size <= PRODUCT_LOOKUP_CACHE_MAX_ENTRIES) {
      return;
    }

    const oldestKey = this.productLookupCache.keys().next().value;
    if (oldestKey) {
      this.productLookupCache.delete(oldestKey);
    }
  }

  async listProducts(search?: string): Promise<{ items: PilotoProduct[] }> {
    const trimmedSearch = search?.trim();

    const rows = trimmedSearch
      ? await this.databaseService.query<PilotoProductRow[]>(
          `SELECT ${PRODUCT_COLUMNS}
           FROM saas_piloto_products
           WHERE name LIKE ?
           ORDER BY name ASC
           LIMIT 100`,
          [`%${trimmedSearch}%`]
        )
      : await this.databaseService.query<PilotoProductRow[]>(
          `SELECT ${PRODUCT_COLUMNS}
           FROM saas_piloto_products
           ORDER BY name ASC
           LIMIT 100`
        );

    return { items: rows.map((row) => this.mapProduct(row)) };
  }

  async createProduct(dto: CreatePilotoProductDto): Promise<{ item: PilotoProduct }> {
    const name = dto.name.trim();
    const barcode = dto.barcode.trim();
    const normalizedBarcode = normalizeBarcode(barcode);

    if (!normalizedBarcode) {
      throw new BadRequestException("Codigo de barras invalido");
    }

    const duplicateRows = await this.databaseService.query<PilotoProductRow[]>(
      `SELECT ${PRODUCT_COLUMNS}
       FROM saas_piloto_products
       WHERE barcode_normalized = ?
       LIMIT 1`,
      [normalizedBarcode]
    );

    if (duplicateRows[0]) {
      throw new BadRequestException("Ya existe un producto con ese codigo de barras");
    }

    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_piloto_products (
         name,
         barcode,
         barcode_normalized,
         price,
         stock,
         status
       ) VALUES (?, ?, ?, ?, ?, ?)`,
      [name, barcode, normalizedBarcode, dto.price, dto.stock ?? 0, dto.status ?? "active"]
    );

    const rows = await this.databaseService.query<PilotoProductRow[]>(
      `SELECT ${PRODUCT_COLUMNS}
       FROM saas_piloto_products
       WHERE id = ?
       LIMIT 1`,
      [result.insertId]
    );

    const product = this.mapProduct(rows[0]);
    if (PRODUCT_LOOKUP_CACHE_ENABLED) {
      this.setProductLookupCache(normalizedBarcode, product);
    }
    return { item: product };
  }

  async updateProduct(productId: number, dto: UpdatePilotoProductDto): Promise<{ item: PilotoProduct }> {
    const existingRows = await this.databaseService.query<PilotoProductRow[]>(
      `SELECT ${PRODUCT_COLUMNS}
       FROM saas_piloto_products
       WHERE id = ?
       LIMIT 1`,
      [productId]
    );

    const existing = existingRows[0];
    if (!existing) {
      throw new NotFoundException("Producto no encontrado");
    }

    const nextName = dto.name?.trim() || existing.name;
    const nextPrice = dto.price ?? Number(existing.price);

    await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_piloto_products
       SET name = ?,
           price = ?
       WHERE id = ?`,
      [nextName, nextPrice, productId]
    );

    const rows = await this.databaseService.query<PilotoProductRow[]>(
      `SELECT ${PRODUCT_COLUMNS}
       FROM saas_piloto_products
       WHERE id = ?
       LIMIT 1`,
      [productId]
    );

    const product = this.mapProduct(rows[0]);
    if (PRODUCT_LOOKUP_CACHE_ENABLED) {
      this.setProductLookupCache(normalizeBarcode(product.barcode), product);
    }
    return { item: product };
  }

  async createSale(dto: CreatePilotoSaleDto): Promise<{ item: PilotoSale }> {
    const paymentMethod = dto.paymentMethod ?? "efectivo";
    const normalizedItems = dto.items.map((item) => {
      const lineTotal = Math.round(item.price * item.quantity * 100) / 100;
      return {
        productId: item.productId ?? null,
        name: item.name.trim(),
        unitPrice: item.price,
        quantity: item.quantity,
        lineTotal,
        imageUrl: item.imageUrl ?? null
      };
    });

    const totalAmount = Math.round(normalizedItems.reduce((total, item) => total + item.lineTotal, 0) * 100) / 100;
    const itemsCount = normalizedItems.reduce((total, item) => total + item.quantity, 0);

    const saleId = await this.databaseService.withTransaction(async (connection) => {
      const [saleResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO saas_piloto_sales (
           total_amount,
           items_count,
           payment_method,
           status
         ) VALUES (?, ?, ?, 'confirmed')`,
        [totalAmount, itemsCount, paymentMethod]
      );

      const createdSaleId = Number(saleResult.insertId);

      for (const item of normalizedItems) {
        await connection.execute<ResultSetHeader>(
          `INSERT INTO saas_piloto_sale_items (
             sale_id,
             product_id,
             product_name,
             unit_price,
             quantity,
             line_total,
             image_url
           ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [createdSaleId, item.productId, item.name, item.unitPrice, item.quantity, item.lineTotal, item.imageUrl]
        );
      }

      return createdSaleId;
    });

    return {
      item: {
        id: saleId,
        totalAmount,
        itemsCount,
        paymentMethod,
        createdAt: new Date().toISOString()
      }
    };
  }

  // Imagen del producto: se guarda en saas_piloto_product_images (binario,
  // no base64) y se sirve por separado via GET /piloto/products/:id/image,
  // con cache headers (ver piloto.controller.ts). Devuelve null si el
  // producto no tiene imagen o el hash no coincide con el guardado (permite
  // invalidar cache del lado del cliente).
  async getProductImage(productId: number): Promise<{ buffer: Buffer; mimeType: string; sourceHash: string } | null> {
    const rows = await this.databaseService.query<PilotoProductImageRow[]>(
      `SELECT image_data, mime_type, source_hash FROM saas_piloto_product_images WHERE product_id = ? LIMIT 1`,
      [productId]
    );

    if (!rows[0]) {
      return null;
    }

    return { buffer: rows[0].image_data, mimeType: rows[0].mime_type, sourceHash: rows[0].source_hash };
  }

  // Acepta un data URI base64 (formato historico) y lo guarda como binario.
  // No hay UI hoy que suba imagenes; queda listo para cuando haga falta
  // (por ejemplo, un import por script o una futura pantalla de edicion).
  async setProductImage(productId: number, dataUri: string): Promise<void> {
    const parsed = parseImageDataUri(dataUri);
    if (!parsed) {
      throw new BadRequestException("La imagen debe ser un data URI base64 valido.");
    }

    const sourceHash = createHash("sha256").update(parsed.buffer).digest("hex");

    await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_piloto_product_images (product_id, image_data, mime_type, source_hash, byte_size)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         image_data = VALUES(image_data),
         mime_type = VALUES(mime_type),
         source_hash = VALUES(source_hash),
         byte_size = VALUES(byte_size)`,
      [productId, parsed.buffer, parsed.mimeType, sourceHash, parsed.buffer.length]
    );

    await this.databaseService.execute<ResultSetHeader>(`UPDATE saas_piloto_products SET has_image = 1 WHERE id = ?`, [
      productId
    ]);
  }

  private mapProduct(row: PilotoProductRow): PilotoProduct {
    return {
      id: row.id,
      name: row.name,
      barcode: row.barcode,
      price: Number(row.price),
      stock: Number(row.stock),
      hasImage: Boolean(row.has_image),
      status: row.status,
      createdAt: this.toIsoString(row.created_at),
      updatedAt: this.toIsoString(row.updated_at)
    };
  }

  private toIsoString(value: string | Date) {
    return value instanceof Date ? value.toISOString() : value;
  }
}
