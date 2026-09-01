import { Injectable, NotFoundException } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CreateEjemploProductDto } from "./dto/create-ejemplo-product.dto";
import { UpdateEjemploProductDto } from "./dto/update-ejemplo-product.dto";
import { EjemploProduct } from "./ejemplo.types";

type EjemploProductRow = RowDataPacket & {
  id: number;
  rubro: string;
  category: string;
  name: string;
  price: string | number;
  description: string | null;
  image_url: string | null;
  created_at: string | Date;
};

const PRODUCT_COLUMNS = "id, rubro, category, name, price, description, image_url, created_at";

// Datos de ejemplo (inventados, no son un cliente real) para que la demo
// arranque con contenido apenas se crea la tabla. Cada rubro nuevo que se
// necesite para una llamada se puede cargar despues a mano desde la app
// (no hace falta tocar codigo).
const SEED_PRODUCTS: Array<Omit<CreateEjemploProductDto, "description"> & { description: string }> = [
  { rubro: "pesca", category: "Cañas", name: "Caña de pesca spinning 2.10m", price: 45, description: "Fibra de carbono, accion media" },
  { rubro: "pesca", category: "Cañas", name: "Caña de pesca surfcasting 4.20m", price: 89, description: "Para pesca de costa" },
  { rubro: "pesca", category: "Reeles", name: "Reel frontal 4000", price: 65, description: "6 rulemanes, freno delantero" },
  { rubro: "pesca", category: "Aire comprimido", name: "Rifle de aire comprimido 5.5mm", price: 320, description: "PCP, mira telescopica incluida" },
  { rubro: "pesca", category: "Aire comprimido", name: "Balines 5.5mm (lata x250)", price: 12, description: "Punta redonda" },
  { rubro: "pesca", category: "Accesorios", name: "Cuerda de nylon 0.30mm (100m)", price: 8, description: "Resistencia 12kg" },
  { rubro: "pesca", category: "Accesorios", name: "Anzuelos surtidos (caja x50)", price: 15, description: "Numeros 4 al 10" },
  { rubro: "pesca", category: "Accesorios", name: "Cubierta impermeable para equipo", price: 22, description: "Protege caña y reel del agua" },
  { rubro: "pesca", category: "Indumentaria", name: "Waders (botas de vadeo)", price: 95, description: "Neopreno, talles S a XL" },
  { rubro: "pesca", category: "Carnada", name: "Carnada artificial variada (set x10)", price: 18, description: "Para spinning liviano" },
  { rubro: "cafeteria", category: "Cafe", name: "Cafe en grano 1kg", price: 14, description: "Tueste medio, origen unico" },
  { rubro: "cafeteria", category: "Cafe", name: "Capuccino grande", price: 3.5, description: "Con espuma de leche" },
  { rubro: "cafeteria", category: "Panaderia", name: "Medialuna", price: 1.2, description: "Manteca, recien horneada" },
  { rubro: "cafeteria", category: "Panaderia", name: "Tostado jamon y queso", price: 4.8, description: "Pan de campo" },
  { rubro: "cafeteria", category: "Bebidas frias", name: "Limonada natural", price: 3, description: "Jarra 500ml" },
  { rubro: "cafeteria", category: "Postres", name: "Torta de chocolate (porcion)", price: 4.5, description: "Con dulce de leche" }
];

@Injectable()
export class EjemploProductsService {
  private ensureTablesPromise: Promise<void> | null = null;

  constructor(private readonly databaseService: DatabaseService) {}

  async listRubros() {
    await this.ensureTables();
    const rows = await this.databaseService.query<RowDataPacket[]>(
      `SELECT DISTINCT rubro FROM saas_ejemplo_products ORDER BY rubro ASC`
    );
    return { items: rows.map((row) => row.rubro as string) };
  }

  async listProducts(rubro?: string) {
    await this.ensureTables();

    const rows = rubro
      ? await this.databaseService.query<EjemploProductRow[]>(
          `SELECT ${PRODUCT_COLUMNS} FROM saas_ejemplo_products WHERE rubro = ? ORDER BY category ASC, name ASC`,
          [rubro]
        )
      : await this.databaseService.query<EjemploProductRow[]>(
          `SELECT ${PRODUCT_COLUMNS} FROM saas_ejemplo_products ORDER BY rubro ASC, category ASC, name ASC`
        );

    return { items: rows.map((row) => this.mapProduct(row)) };
  }

  async createProduct(dto: CreateEjemploProductDto) {
    await this.ensureTables();

    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_ejemplo_products (rubro, category, name, price, description, image_url) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        dto.rubro.trim().toLowerCase(),
        dto.category.trim(),
        dto.name.trim(),
        dto.price,
        dto.description?.trim() ?? "",
        dto.imageUrl?.trim() || null
      ]
    );

    return { item: await this.getProductOrThrow(result.insertId) };
  }

  async updateProduct(productId: number, dto: UpdateEjemploProductDto) {
    await this.ensureTables();
    await this.getProductOrThrow(productId);

    const fields: string[] = [];
    const values: Array<string | number | null> = [];

    if (dto.category !== undefined) {
      fields.push("category = ?");
      values.push(dto.category.trim());
    }
    if (dto.name !== undefined) {
      fields.push("name = ?");
      values.push(dto.name.trim());
    }
    if (dto.price !== undefined) {
      fields.push("price = ?");
      values.push(dto.price);
    }
    if (dto.description !== undefined) {
      fields.push("description = ?");
      values.push(dto.description.trim());
    }
    if (dto.imageUrl !== undefined) {
      fields.push("image_url = ?");
      values.push(dto.imageUrl.trim() || null);
    }

    if (fields.length) {
      await this.databaseService.execute(`UPDATE saas_ejemplo_products SET ${fields.join(", ")} WHERE id = ?`, [
        ...values,
        productId
      ]);
    }

    return { item: await this.getProductOrThrow(productId) };
  }

  async deleteProduct(productId: number) {
    await this.ensureTables();
    await this.getProductOrThrow(productId);
    await this.databaseService.execute(`DELETE FROM saas_ejemplo_products WHERE id = ?`, [productId]);
    return { ok: true };
  }

  async getProductOrThrow(productId: number) {
    const rows = await this.databaseService.query<EjemploProductRow[]>(
      `SELECT ${PRODUCT_COLUMNS} FROM saas_ejemplo_products WHERE id = ? LIMIT 1`,
      [productId]
    );
    if (!rows.length) {
      throw new NotFoundException("El producto no existe.");
    }
    return this.mapProduct(rows[0]);
  }

  private mapProduct(row: EjemploProductRow): EjemploProduct {
    return {
      id: String(row.id),
      rubro: row.rubro,
      category: row.category,
      name: row.name,
      price: Number(row.price),
      description: row.description ?? "",
      imageUrl: row.image_url ?? null,
      createdAt: this.toIsoString(row.created_at)
    };
  }

  private toIsoString(value: string | Date) {
    return value instanceof Date ? value.toISOString() : value;
  }

  private async ensureTables() {
    if (!this.ensureTablesPromise) {
      this.ensureTablesPromise = this.createTables().catch((error) => {
        this.ensureTablesPromise = null;
        throw error;
      });
    }
    await this.ensureTablesPromise;
  }

  private async createTables() {
    await this.databaseService.execute(
      `CREATE TABLE IF NOT EXISTS saas_ejemplo_products (
         id INT AUTO_INCREMENT PRIMARY KEY,
         rubro VARCHAR(60) NOT NULL,
         category VARCHAR(80) NOT NULL,
         name VARCHAR(160) NOT NULL,
         price DECIMAL(12,2) NOT NULL DEFAULT 0,
         description VARCHAR(255) NOT NULL DEFAULT '',
         created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
         KEY idx_saas_ejemplo_products_rubro (rubro)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    );

    // image_url se agrego despues (foto del producto para las tarjetas) --
    // LONGTEXT porque guarda la imagen como data URL base64 ya
    // redimensionada en el frontend, no una URL corta.
    const hasImageUrlColumn = await this.hasColumn("saas_ejemplo_products", "image_url");
    if (!hasImageUrlColumn) {
      await this.databaseService.execute(
        `ALTER TABLE saas_ejemplo_products ADD COLUMN image_url LONGTEXT NULL DEFAULT NULL AFTER description`
      );
    }

    const [{ total }] = await this.databaseService.query<Array<RowDataPacket & { total: number }>>(
      `SELECT COUNT(*) AS total FROM saas_ejemplo_products`
    );

    if (Number(total) === 0) {
      for (const product of SEED_PRODUCTS) {
        await this.databaseService.execute(
          `INSERT INTO saas_ejemplo_products (rubro, category, name, price, description) VALUES (?, ?, ?, ?, ?)`,
          [product.rubro, product.category, product.name, product.price, product.description]
        );
      }
    }
  }

  private async hasColumn(tableName: string, columnName: string) {
    const rows = await this.databaseService.query<Array<RowDataPacket & { total: number }>>(
      `SELECT COUNT(*) AS total
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND COLUMN_NAME = ?`,
      [tableName, columnName]
    );

    return Number(rows[0]?.total || 0) > 0;
  }
}
