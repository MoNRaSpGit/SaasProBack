import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
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
  image_url: string | null;
  status: "active" | "inactive";
  created_at: string | Date;
  updated_at: string | Date;
};

const PRODUCT_COLUMNS = `
  id,
  name,
  barcode,
  price,
  stock,
  image_url,
  status,
  created_at,
  updated_at
`;

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
         image_url,
         status
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, barcode, normalizedBarcode, dto.price, dto.stock ?? 0, dto.imageUrl ?? null, dto.status ?? "active"]
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

  private mapProduct(row: PilotoProductRow): PilotoProduct {
    return {
      id: row.id,
      name: row.name,
      barcode: row.barcode,
      price: Number(row.price),
      stock: Number(row.stock),
      imageUrl: row.image_url,
      status: row.status,
      createdAt: this.toIsoString(row.created_at),
      updatedAt: this.toIsoString(row.updated_at)
    };
  }

  private toIsoString(value: string | Date) {
    return value instanceof Date ? value.toISOString() : value;
  }
}
