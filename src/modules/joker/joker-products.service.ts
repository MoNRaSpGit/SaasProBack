import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { BulkApplyJokerRecipeDto } from "./dto/bulk-apply-joker-recipe.dto";
import { CreateJokerProductDto } from "./dto/create-joker-product.dto";
import { SetJokerProductRecipeDto } from "./dto/set-joker-product-recipe.dto";
import { UpdateJokerProductDto } from "./dto/update-joker-product.dto";
import { toIsoString } from "./joker.dateUtils";
import { JokerComboSlot, JokerProduct, JokerProductRecipeLine } from "./joker.types";

type JokerProductRow = RowDataPacket & {
  id: number;
  name: string;
  category: string;
  subcategory: string | null;
  subcategory_detail: string | null;
  brand: string | null;
  price: string | number;
  ingredients: string | null;
  observations: string | null;
  product_type: string;
  status: string;
  pricing_unit: string;
  created_at: string | Date;
  updated_at: string | Date;
};

type JokerComboSlotRow = RowDataPacket & {
  id: number;
  combo_product_id: number;
  slot_label: string;
  slot_quantity: number;
  option_product_ids: string;
  sort_order: number;
};

type JokerProductRecipeRow = RowDataPacket & {
  stock_item_id: number;
  stock_item_name: string;
  unit: string;
  quantity_per_unit: string | number;
};

const PRODUCT_COLUMNS = `
  id,
  name,
  category,
  subcategory,
  subcategory_detail,
  brand,
  price,
  ingredients,
  observations,
  product_type,
  status,
  pricing_unit,
  created_at,
  updated_at
`;

@Injectable()
export class JokerProductsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listProducts(): Promise<{ items: JokerProduct[] }> {
    const rows = await this.databaseService.query<JokerProductRow[]>(
      `SELECT ${PRODUCT_COLUMNS}
       FROM saas_joker_products
       ORDER BY category ASC, name ASC
       LIMIT 1000`
    );

    const slotRows = await this.databaseService.query<JokerComboSlotRow[]>(
      `SELECT id, combo_product_id, slot_label, slot_quantity, option_product_ids, sort_order
       FROM saas_joker_combo_slots
       ORDER BY combo_product_id ASC, sort_order ASC`
    );

    const slotsByComboId = new Map<number, JokerComboSlot[]>();
    for (const row of slotRows) {
      const list = slotsByComboId.get(row.combo_product_id) ?? [];
      list.push({
        label: row.slot_label,
        quantity: row.slot_quantity,
        optionProductIds:
          typeof row.option_product_ids === "string" ? JSON.parse(row.option_product_ids) : row.option_product_ids
      });
      slotsByComboId.set(row.combo_product_id, list);
    }

    return { items: rows.map((row) => this.mapProduct(row, slotsByComboId.get(row.id))) };
  }

  // Si viene initialStock, ademas del producto se crea de una un insumo
  // propio (mismo nombre) y una receta 1 a 1 -- pensado para productos
  // "autonomos" que no comparten stock con nada mas (ej: alcohol en gel,
  // una gaseosa), para no tener que pasar por la pestana Stock aparte.
  // Todo en una transaccion: si algo falla a mitad de camino, no queda
  // el producto creado sin su insumo.
  async createProduct(dto: CreateJokerProductDto): Promise<{ item: JokerProduct }> {
    const name = dto.name.trim();
    const category = dto.category?.trim() || "Otros";

    const productId = await this.databaseService.withTransaction(async (connection) => {
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO saas_joker_products
           (name, category, subcategory, subcategory_detail, brand, price, ingredients, observations, product_type, status, pricing_unit)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          name,
          category,
          dto.subcategory?.trim() || null,
          dto.subcategoryDetail?.trim() || null,
          dto.brand?.trim() || null,
          dto.price,
          dto.ingredients?.trim() || null,
          dto.observations?.trim() || null,
          dto.productType ?? "simple",
          dto.status ?? "published",
          dto.pricingUnit ?? "unidad"
        ]
      );

      if (dto.initialStock !== undefined) {
        const [stockResult] = await connection.execute<ResultSetHeader>(
          `INSERT INTO saas_joker_stock_items (name, unit, category, quantity) VALUES (?, ?, ?, ?)`,
          [name, "unidad", "otro", dto.initialStock]
        );

        await connection.execute(
          `INSERT INTO saas_joker_product_recipes (product_id, stock_item_id, quantity_per_unit) VALUES (?, ?, ?)`,
          [result.insertId, stockResult.insertId, 1]
        );
      }

      return result.insertId;
    });

    const rows = await this.databaseService.query<JokerProductRow[]>(
      `SELECT ${PRODUCT_COLUMNS}
       FROM saas_joker_products
       WHERE id = ?
       LIMIT 1`,
      [productId]
    );

    return { item: this.mapProduct(rows[0]) };
  }

  async updateProduct(productId: number, dto: UpdateJokerProductDto): Promise<{ item: JokerProduct }> {
    const existingRows = await this.databaseService.query<JokerProductRow[]>(
      `SELECT ${PRODUCT_COLUMNS}
       FROM saas_joker_products
       WHERE id = ?
       LIMIT 1`,
      [productId]
    );

    const existing = existingRows[0];
    if (!existing) {
      throw new NotFoundException("Producto no encontrado");
    }

    const nextName = dto.name?.trim() || existing.name;
    const nextCategory = dto.category?.trim() || existing.category;
    const nextPrice = dto.price ?? Number(existing.price);
    const nextSubcategory = dto.subcategory !== undefined ? dto.subcategory?.trim() || null : existing.subcategory;
    const nextSubcategoryDetail =
      dto.subcategoryDetail !== undefined ? dto.subcategoryDetail?.trim() || null : existing.subcategory_detail;
    const nextBrand = dto.brand !== undefined ? dto.brand?.trim() || null : existing.brand;
    const nextIngredients = dto.ingredients !== undefined ? dto.ingredients?.trim() || null : existing.ingredients;
    const nextObservations = dto.observations !== undefined ? dto.observations?.trim() || null : existing.observations;
    const nextProductType = dto.productType ?? existing.product_type;
    const nextStatus = dto.status ?? existing.status;
    const nextPricingUnit = dto.pricingUnit ?? existing.pricing_unit;

    await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_joker_products
       SET name = ?,
           category = ?,
           subcategory = ?,
           subcategory_detail = ?,
           brand = ?,
           price = ?,
           ingredients = ?,
           observations = ?,
           product_type = ?,
           status = ?,
           pricing_unit = ?
       WHERE id = ?`,
      [
        nextName,
        nextCategory,
        nextSubcategory,
        nextSubcategoryDetail,
        nextBrand,
        nextPrice,
        nextIngredients,
        nextObservations,
        nextProductType,
        nextStatus,
        nextPricingUnit,
        productId
      ]
    );

    const rows = await this.databaseService.query<JokerProductRow[]>(
      `SELECT ${PRODUCT_COLUMNS}
       FROM saas_joker_products
       WHERE id = ?
       LIMIT 1`,
      [productId]
    );

    return { item: this.mapProduct(rows[0]) };
  }

  async deleteProduct(productId: number): Promise<{ ok: true }> {
    const result = await this.databaseService.execute<ResultSetHeader>(
      `DELETE FROM saas_joker_products WHERE id = ?`,
      [productId]
    );

    if (result.affectedRows === 0) {
      throw new NotFoundException("Producto no encontrado");
    }

    return { ok: true };
  }

  async getProductRecipe(productId: number): Promise<{ items: JokerProductRecipeLine[] }> {
    const rows = await this.databaseService.query<JokerProductRecipeRow[]>(
      `SELECT r.stock_item_id, s.name AS stock_item_name, s.unit, r.quantity_per_unit
       FROM saas_joker_product_recipes r
       INNER JOIN saas_joker_stock_items s ON s.id = r.stock_item_id
       WHERE r.product_id = ?
       ORDER BY s.name ASC`,
      [productId]
    );

    return { items: rows.map((row) => this.mapRecipeLine(row)) };
  }

  // Reemplaza toda la receta del producto (borra lo que tenia y carga lo nuevo).
  async setProductRecipe(productId: number, dto: SetJokerProductRecipeDto): Promise<{ items: JokerProductRecipeLine[] }> {
    await this.databaseService.withTransaction(async (connection) => {
      await connection.execute(`DELETE FROM saas_joker_product_recipes WHERE product_id = ?`, [productId]);

      for (const line of dto.items) {
        await connection.execute(
          `INSERT INTO saas_joker_product_recipes (product_id, stock_item_id, quantity_per_unit) VALUES (?, ?, ?)`,
          [productId, line.stockItemId, line.quantityPerUnit]
        );
      }
    });

    return this.getProductRecipe(productId);
  }

  // Aplica la misma receta a todos los productos de una categoria de una
  // sola vez (ej: "Hamburguesas" = 1 churrasco + 1 pan), para no cargar
  // producto por producto. Las excepciones (ej. BBQ 2.0) se ajustan despues
  // a mano con setProductRecipe sobre ese producto puntual.
  async bulkApplyRecipe(dto: BulkApplyJokerRecipeDto): Promise<{ affectedProducts: number }> {
    const productRows = await this.databaseService.query<Array<RowDataPacket & { id: number }>>(
      `SELECT id FROM saas_joker_products WHERE category = ?`,
      [dto.category]
    );

    if (!productRows.length) {
      throw new BadRequestException("No hay productos en esa categoria");
    }

    await this.databaseService.withTransaction(async (connection) => {
      for (const product of productRows) {
        await connection.execute(`DELETE FROM saas_joker_product_recipes WHERE product_id = ?`, [product.id]);

        for (const line of dto.items) {
          await connection.execute(
            `INSERT INTO saas_joker_product_recipes (product_id, stock_item_id, quantity_per_unit) VALUES (?, ?, ?)`,
            [product.id, line.stockItemId, line.quantityPerUnit]
          );
        }
      }
    });

    return { affectedProducts: productRows.length };
  }

  private mapRecipeLine(row: JokerProductRecipeRow): JokerProductRecipeLine {
    return {
      stockItemId: row.stock_item_id,
      stockItemName: row.stock_item_name,
      unit: row.unit,
      quantityPerUnit: Number(row.quantity_per_unit)
    };
  }

  private mapProduct(row: JokerProductRow, comboSlots?: JokerComboSlot[]): JokerProduct {
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      subcategory: row.subcategory,
      subcategoryDetail: row.subcategory_detail,
      brand: row.brand,
      price: Number(row.price),
      ingredients: row.ingredients,
      observations: row.observations,
      productType: row.product_type === "extra" ? "extra" : "simple",
      status: row.status === "draft" ? "draft" : "published",
      pricingUnit: row.pricing_unit === "kg" ? "kg" : "unidad",
      createdAt: toIsoString(row.created_at),
      updatedAt: toIsoString(row.updated_at),
      comboSlots: comboSlots?.length ? comboSlots : undefined
    };
  }
}
