import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CreatePilotoProductDto } from "./dto/create-piloto-product.dto";
import { PilotoProduct } from "./piloto.types";

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

@Injectable()
export class PilotoService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findByBarcode(barcode: string): Promise<{ item: PilotoProduct }> {
    const normalizedBarcode = normalizeBarcode(barcode);
    if (!normalizedBarcode) {
      throw new BadRequestException("Codigo de barras invalido");
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

    return { item: this.mapProduct(rows[0]) };
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

    return { item: this.mapProduct(rows[0]) };
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
