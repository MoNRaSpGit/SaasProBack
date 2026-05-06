import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { AlamcenProductLookupResponse } from "./alamcen.types";
import { CreateManualProductDto } from "./dto/create-manual-product.dto";

type OpsProductoRow = RowDataPacket & {
  id: number;
  legacy_producto_id: number | null;
  nombre: string;
  descripcion: string | null;
  barcode: string | null;
  barcode_normalized: string | null;
  precio_venta: string | number;
  precio_lista: string | number | null;
  stock_actual: number;
  categoria: string | null;
  categoria_compact: string | null;
  categoria_id: number | null;
  supplier_id: number | null;
  subcategoria: string | null;
  tiene_imagen: number | boolean;
  estado: AlamcenProductLookupResponse["estado"];
  imagen: string | null;
};

@Injectable()
export class AlamcenService {
  constructor(private readonly databaseService: DatabaseService) {}

  getStatus() {
    return {
      module: "alamcen",
      status: "ok",
      capabilities: ["barcode-lookup", "local-cart-demo"],
      sourceTable: "ops_producto"
    };
  }

  async getProductByBarcode(barcode: string) {
    const normalizedBarcode = this.normalizeBarcode(barcode);
    if (!normalizedBarcode) {
      throw new BadRequestException("El codigo de barras es obligatorio.");
    }

    const row = await this.findProductRowByBarcode(normalizedBarcode);
    return row ? this.mapProductRow(row) : null;
  }

  async createManualProduct(payload: CreateManualProductDto) {
    const normalizedBarcode = this.normalizeBarcode(payload.barcode);
    if (!normalizedBarcode) {
      throw new BadRequestException("El codigo de barras es obligatorio.");
    }

    const existingProduct = await this.findProductRowByBarcode(normalizedBarcode);
    if (existingProduct) {
      return this.mapProductRow(existingProduct);
    }

    try {
      const result = await this.databaseService.execute<ResultSetHeader>(
        `INSERT INTO ops_producto (
           nombre,
           barcode,
           barcode_normalized,
           precio_venta,
           stock_actual,
           categoria,
           categoria_compact,
           tiene_imagen,
           estado,
           origen
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "Producto Manual",
          normalizedBarcode,
          normalizedBarcode,
          payload.price,
          0,
          "manual",
          "manual",
          0,
          "activo",
          "nuevo"
        ]
      );

      const createdRows = await this.databaseService.query<OpsProductoRow[]>(
        `SELECT
           id,
           legacy_producto_id,
           nombre,
           descripcion,
           barcode,
           barcode_normalized,
           precio_venta,
           precio_lista,
           stock_actual,
           categoria,
           categoria_compact,
           categoria_id,
           supplier_id,
           subcategoria,
           tiene_imagen,
           estado,
           imagen
         FROM ops_producto
         WHERE id = ?
         LIMIT 1`,
        [result.insertId]
      );

      if (!createdRows[0]) {
        throw new BadRequestException("No se pudo recuperar el producto manual creado.");
      }

      return this.mapProductRow(createdRows[0]);
    } catch (error) {
      const dbError = error as { code?: string };
      if (dbError.code === "ER_DUP_ENTRY") {
        const duplicatedProduct = await this.findProductRowByBarcode(normalizedBarcode);
        if (duplicatedProduct) {
          return this.mapProductRow(duplicatedProduct);
        }

        throw new ConflictException("El codigo de barras ya existe.");
      }

      throw error;
    }
  }

  private normalizeBarcode(value: string) {
    return value.trim().replace(/\s+/g, "");
  }

  private buildBarcodeCandidates(value: string) {
    const digitsOnly = value.replace(/\D+/g, "");
    return Array.from(new Set([value, digitsOnly].filter(Boolean)));
  }

  private async findProductRowByBarcode(barcode: string) {
    const candidates = this.buildBarcodeCandidates(barcode);
    const placeholders = candidates.map(() => "?").join(", ");

    const rows = await this.databaseService.query<OpsProductoRow[]>(
      `SELECT
         id,
         legacy_producto_id,
         nombre,
         descripcion,
         barcode,
         barcode_normalized,
         precio_venta,
         precio_lista,
         stock_actual,
         categoria,
         categoria_compact,
         categoria_id,
         supplier_id,
         subcategoria,
         tiene_imagen,
         estado,
         imagen
       FROM ops_producto
       WHERE barcode_normalized IN (${placeholders})
          OR barcode IN (${placeholders})
       ORDER BY (estado = 'activo') DESC, id ASC
       LIMIT 1`,
      [...candidates, ...candidates]
    );

    return rows[0] ?? null;
  }

  private mapProductRow(row: OpsProductoRow): AlamcenProductLookupResponse {
    return {
      id: row.id,
      legacyProductoId: row.legacy_producto_id,
      nombre: row.nombre,
      descripcion: row.descripcion,
      barcode: row.barcode,
      barcodeNormalized: row.barcode_normalized,
      precioVenta: Number(row.precio_venta),
      precioLista: row.precio_lista === null ? null : Number(row.precio_lista),
      stockActual: row.stock_actual,
      categoria: row.categoria,
      categoriaCompact: row.categoria_compact,
      categoriaId: row.categoria_id,
      supplierId: row.supplier_id,
      subcategoria: row.subcategoria,
      tieneImagen: Boolean(row.tiene_imagen),
      estado: row.estado,
      imagen: row.imagen
    };
  }
}
