import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { DatabaseService } from "../../shared/database/database.service";
import { CreateOriolProductDto } from "./dto/create-oriol-product.dto";
import { UpdateOriolProductDto } from "./dto/update-oriol-product.dto";
import { UpdateOriolStockDto } from "./dto/update-oriol-stock.dto";
import { OriolProduct } from "./oriol.types";

const PRODUCT_COLUMNS = "id, name, price, description, currency, codigo_barra, stock, stock_minimo";

type OriolProductRow = RowDataPacket & {
  id: number;
  name: string;
  price: string | number;
  description: string | null;
  currency: "UYU" | "USD";
  codigo_barra: string | null;
  stock: number;
  stock_minimo: number | null;
};

@Injectable()
export class OriolProductsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listProducts(): Promise<{ items: OriolProduct[] }> {
    const rows = await this.databaseService.query<OriolProductRow[]>(
      `SELECT ${PRODUCT_COLUMNS} FROM saas_oriol_prodcutos ORDER BY name`
    );
    return { items: rows.map((row) => this.mapProduct(row)) };
  }

  // Prioriza el nombre que EMPIEZA con la busqueda ("Ramon" para "ram"),
  // despues el que tiene la busqueda como inicio de una palabra ("Pintura
  // Ramplas" para "ram"), y recien al final cualquier coincidencia en
  // medio de una palabra ("500 GRAMOS" para "ram"). Sin esto, un catalogo
  // grande con muchos nombres que comparten una coincidencia parcial
  // (ej: decenas de productos con "Gramos" en el nombre) tapaba productos
  // mas relevantes fuera del limite de resultados.
  async searchProducts(query: string): Promise<{ items: OriolProduct[] }> {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return { items: [] };
    }

    const rows = await this.databaseService.query<OriolProductRow[]>(
      `SELECT ${PRODUCT_COLUMNS} FROM saas_oriol_prodcutos
       WHERE name LIKE ?
       ORDER BY
         CASE
           WHEN name LIKE ? THEN 0
           WHEN name LIKE ? THEN 1
           ELSE 2
         END,
         name ASC
       LIMIT 30`,
      [`%${trimmed}%`, `${trimmed}%`, `% ${trimmed}%`]
    );
    return { items: rows.map((row) => this.mapProduct(row)) };
  }

  async getProductByBarcode(codigoBarra: string): Promise<{ item: OriolProduct }> {
    const rows = await this.databaseService.query<OriolProductRow[]>(
      `SELECT ${PRODUCT_COLUMNS} FROM saas_oriol_prodcutos WHERE codigo_barra = ? LIMIT 1`,
      [codigoBarra]
    );
    if (!rows[0]) {
      throw new NotFoundException("Producto no encontrado");
    }
    return { item: this.mapProduct(rows[0]) };
  }

  async getProduct(productId: number): Promise<{ item: OriolProduct }> {
    const rows = await this.databaseService.query<OriolProductRow[]>(
      `SELECT ${PRODUCT_COLUMNS} FROM saas_oriol_prodcutos WHERE id = ? LIMIT 1`,
      [productId]
    );
    if (!rows[0]) {
      throw new NotFoundException("Producto no encontrado");
    }
    return { item: this.mapProduct(rows[0]) };
  }

  async createProduct(dto: CreateOriolProductDto): Promise<{ item: OriolProduct }> {
    try {
      const result = await this.databaseService.execute<ResultSetHeader>(
        `INSERT INTO saas_oriol_prodcutos (name, price, description, currency, codigo_barra, stock, stock_minimo)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [dto.name.trim(), dto.price, dto.description ?? null, dto.currency, dto.codigoBarra ?? null, dto.stock, dto.stockMinimo ?? null]
      );
      return this.getProduct(result.insertId);
    } catch (error) {
      throw this.mapDuplicateBarcodeError(error);
    }
  }

  async updateProduct(productId: number, dto: UpdateOriolProductDto): Promise<{ item: OriolProduct }> {
    try {
      const result = await this.databaseService.execute<ResultSetHeader>(
        `UPDATE saas_oriol_prodcutos
         SET name = ?, price = ?, description = ?, currency = ?, codigo_barra = ?, stock = ?, stock_minimo = ?
         WHERE id = ?`,
        [
          dto.name.trim(),
          dto.price,
          dto.description ?? null,
          dto.currency,
          dto.codigoBarra ?? null,
          dto.stock,
          dto.stockMinimo ?? null,
          productId
        ]
      );
      if (!result.affectedRows) {
        throw new NotFoundException("Producto no encontrado");
      }
      return this.getProduct(productId);
    } catch (error) {
      throw this.mapDuplicateBarcodeError(error);
    }
  }

  async updateStock(productId: number, dto: UpdateOriolStockDto): Promise<{ item: OriolProduct }> {
    const sets: string[] = [];
    const params: Array<number> = [];

    if (dto.stock !== undefined) {
      sets.push("stock = ?");
      params.push(dto.stock);
    }
    if (dto.stockMinimo !== undefined) {
      sets.push("stock_minimo = ?");
      params.push(dto.stockMinimo);
    }

    if (!sets.length) {
      throw new BadRequestException("No hay nada para actualizar");
    }

    const result = await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_oriol_prodcutos SET ${sets.join(", ")} WHERE id = ?`,
      [...params, productId]
    );
    if (!result.affectedRows) {
      throw new NotFoundException("Producto no encontrado");
    }
    return this.getProduct(productId);
  }

  async deleteProduct(productId: number): Promise<{ ok: true }> {
    const result = await this.databaseService.execute<ResultSetHeader>(`DELETE FROM saas_oriol_prodcutos WHERE id = ?`, [
      productId
    ]);
    if (!result.affectedRows) {
      throw new NotFoundException("Producto no encontrado");
    }
    return { ok: true };
  }

  // Usado por OriolSalesService dentro de la misma transaccion que crea
  // la venta -- recibe la connection en vez de usar this.databaseService
  // para que el descuento de stock y el insert de la venta queden
  // atomicos (si algo falla, se revierte todo junto).
  async decrementStock(connection: PoolConnection, items: Array<{ id: number; cantidad: number }>) {
    for (const item of items) {
      await connection.execute(`UPDATE saas_oriol_prodcutos SET stock = GREATEST(stock - ?, 0) WHERE id = ?`, [
        item.cantidad,
        item.id
      ]);
    }
  }

  private mapDuplicateBarcodeError(error: unknown) {
    const mysqlError = error as { code?: string };
    if (mysqlError.code === "ER_DUP_ENTRY") {
      return new ConflictException("Ya existe un producto con ese codigo de barra");
    }
    return error as Error;
  }

  private mapProduct(row: OriolProductRow): OriolProduct {
    return {
      id: row.id,
      name: row.name,
      price: Number(row.price),
      description: row.description,
      currency: row.currency,
      codigoBarra: row.codigo_barra,
      stock: row.stock,
      stockMinimo: row.stock_minimo
    };
  }
}
