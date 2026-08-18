import { Injectable, NotFoundException } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CreateJokerOrderItemDto } from "./dto/create-joker-order.dto";
import { CreateJokerStockItemDto } from "./dto/create-joker-stock-item.dto";
import { RestockJokerStockItemDto } from "./dto/restock-joker-stock-item.dto";
import { UpdateJokerStockItemDto } from "./dto/update-joker-stock-item.dto";
import { toIsoString } from "./joker.dateUtils";
import { JokerStockItem } from "./joker.types";

type JokerStockItemRow = RowDataPacket & {
  id: number;
  name: string;
  unit: string;
  category: string;
  quantity: string | number;
  created_at: string | Date;
  updated_at: string | Date;
};

type JokerRegisterStateRow = RowDataPacket & {
  is_open: number;
  last_closed_at: string | Date | null;
};

@Injectable()
export class JokerStockService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listStockItems(): Promise<{ items: JokerStockItem[] }> {
    const rows = await this.databaseService.query<JokerStockItemRow[]>(
      `SELECT id, name, unit, category, quantity, created_at, updated_at
       FROM saas_joker_stock_items
       ORDER BY name ASC`
    );

    return { items: rows.map((row) => this.mapStockItem(row)) };
  }

  async createStockItem(dto: CreateJokerStockItemDto): Promise<{ item: JokerStockItem }> {
    const name = dto.name.trim();

    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_joker_stock_items (name, unit, category, quantity) VALUES (?, ?, ?, ?)`,
      [name, dto.unit?.trim() || "unidad", dto.category ?? "comida", dto.quantity ?? 0]
    );

    const rows = await this.databaseService.query<JokerStockItemRow[]>(
      `SELECT id, name, unit, category, quantity, created_at, updated_at FROM saas_joker_stock_items WHERE id = ? LIMIT 1`,
      [result.insertId]
    );

    return { item: this.mapStockItem(rows[0]) };
  }

  // Reponer stock: suma (o resta, si se manda negativo) a la cantidad actual.
  async restockItem(stockItemId: number, dto: RestockJokerStockItemDto): Promise<{ item: JokerStockItem }> {
    const result = await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_joker_stock_items SET quantity = quantity + ? WHERE id = ?`,
      [dto.quantity, stockItemId]
    );

    if (!result.affectedRows) {
      throw new NotFoundException("Insumo no encontrado");
    }

    if (dto.quantity !== 0) {
      await this.databaseService.execute<ResultSetHeader>(
        `INSERT INTO saas_joker_stock_movements (stock_item_id, quantity_delta, reason) VALUES (?, ?, 'restock')`,
        [stockItemId, dto.quantity]
      );
    }

    const rows = await this.databaseService.query<JokerStockItemRow[]>(
      `SELECT id, name, unit, category, quantity, created_at, updated_at FROM saas_joker_stock_items WHERE id = ? LIMIT 1`,
      [stockItemId]
    );

    return { item: this.mapStockItem(rows[0]) };
  }

  // Fija el stock a un valor exacto (boton "Editar" del tablero). Queda
  // registrado como ajuste manual, distinto de una venta o una reposicion.
  async updateStockItemQuantity(stockItemId: number, dto: UpdateJokerStockItemDto): Promise<{ item: JokerStockItem }> {
    const rows = await this.databaseService.query<JokerStockItemRow[]>(
      `SELECT id, name, unit, category, quantity, created_at, updated_at FROM saas_joker_stock_items WHERE id = ? LIMIT 1`,
      [stockItemId]
    );
    const existing = rows[0];
    if (!existing) {
      throw new NotFoundException("Insumo no encontrado");
    }

    const delta = dto.quantity - Number(existing.quantity);

    await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_joker_stock_items SET quantity = ? WHERE id = ?`,
      [dto.quantity, stockItemId]
    );

    if (delta !== 0) {
      await this.databaseService.execute<ResultSetHeader>(
        `INSERT INTO saas_joker_stock_movements (stock_item_id, quantity_delta, reason) VALUES (?, ?, 'ajuste_manual')`,
        [stockItemId, delta]
      );
    }

    const updatedRows = await this.databaseService.query<JokerStockItemRow[]>(
      `SELECT id, name, unit, category, quantity, created_at, updated_at FROM saas_joker_stock_items WHERE id = ? LIMIT 1`,
      [stockItemId]
    );

    return { item: this.mapStockItem(updatedRows[0]) };
  }

  // Historial de que pedidos consumieron este insumo, desde el ultimo
  // cierre de caja (o desde siempre, si todavia no hubo ninguno) -- mismo
  // periodo que usa el Panel. Ej: Pedido #4 -> 4x Pancho. Sirve para
  // reconciliar a mano ("teniamos 20 panes, se vendieron todos, tienen que
  // ser 20 panchos entre los pedidos"). Los movimientos sin pedido
  // vinculado (ajustes/reposiciones, o ventas de antes del fix de
  // order_id) se agrupan aparte con displayNumber null.
  async getStockItemConsumption(
    stockItemId: number
  ): Promise<{ items: Array<{ orderId: number | null; displayNumber: number | null; productName: string; quantity: number; createdAt: string }> }> {
    const stateRows = await this.databaseService.query<JokerRegisterStateRow[]>(
      `SELECT last_closed_at FROM saas_joker_register_state WHERE id = 1 LIMIT 1`
    );
    const lastClosedAt = stateRows[0]?.last_closed_at ?? null;

    const rows = await this.databaseService.query<
      Array<
        RowDataPacket & {
          order_id: number | null;
          display_number: number | null;
          product_name: string | null;
          total_quantity: string | number;
          last_created_at: string | Date;
        }
      >
    >(
      lastClosedAt
        ? `SELECT m.order_id, o.display_number, COALESCE(m.product_name, '(sin nombre)') AS product_name,
                  SUM(-m.quantity_delta) AS total_quantity, MAX(m.created_at) AS last_created_at
           FROM saas_joker_stock_movements m
           LEFT JOIN saas_joker_orders o ON o.id = m.order_id
           WHERE m.stock_item_id = ? AND m.reason = 'venta' AND m.quantity_delta < 0 AND m.created_at > ?
           GROUP BY m.order_id, COALESCE(m.product_name, '(sin nombre)')
           ORDER BY last_created_at DESC`
        : `SELECT m.order_id, o.display_number, COALESCE(m.product_name, '(sin nombre)') AS product_name,
                  SUM(-m.quantity_delta) AS total_quantity, MAX(m.created_at) AS last_created_at
           FROM saas_joker_stock_movements m
           LEFT JOIN saas_joker_orders o ON o.id = m.order_id
           WHERE m.stock_item_id = ? AND m.reason = 'venta' AND m.quantity_delta < 0
           GROUP BY m.order_id, COALESCE(m.product_name, '(sin nombre)')
           ORDER BY last_created_at DESC`,
      lastClosedAt ? [stockItemId, lastClosedAt] : [stockItemId]
    );

    return {
      items: rows.map((row) => ({
        orderId: row.order_id,
        displayNumber: row.display_number,
        productName: row.product_name ?? "(sin nombre)",
        quantity: Number(row.total_quantity),
        createdAt: toIsoString(row.last_created_at)
      }))
    };
  }

  async deleteStockItem(stockItemId: number): Promise<{ ok: true }> {
    const result = await this.databaseService.execute<ResultSetHeader>(
      `DELETE FROM saas_joker_stock_items WHERE id = ?`,
      [stockItemId]
    );

    if (!result.affectedRows) {
      throw new NotFoundException("Insumo no encontrado");
    }

    return { ok: true };
  }

  // Descuenta stock segun la receta de cada producto vendido (si no tiene
  // receta cargada, no se toca nada). No bloquea la venta si algun insumo
  // queda en negativo -- eso se avisa despues en la pantalla de Stock. Cada
  // descuento queda registrado en saas_joker_stock_movements, para poder
  // mostrar despues que producto se llevo cada insumo (ver
  // getStockItemConsumption). Lo llama JokerOrdersService al crear/editar
  // un pedido.
  async deductStockForOrderItems(items: CreateJokerOrderItemDto[], orderId?: number): Promise<void> {
    const productIds = [...new Set(items.map((item) => item.productId))];
    if (!productIds.length) return;

    const placeholders = productIds.map(() => "?").join(", ");
    const recipeRows = await this.databaseService.query<
      Array<RowDataPacket & { product_id: number; stock_item_id: number; quantity_per_unit: string | number }>
    >(
      `SELECT product_id, stock_item_id, quantity_per_unit
       FROM saas_joker_product_recipes
       WHERE product_id IN (${placeholders})`,
      productIds
    );

    if (!recipeRows.length) return;

    const recipesByProduct = new Map<number, Array<{ stockItemId: number; quantityPerUnit: number }>>();
    for (const row of recipeRows) {
      const list = recipesByProduct.get(row.product_id) ?? [];
      list.push({ stockItemId: row.stock_item_id, quantityPerUnit: Number(row.quantity_per_unit) });
      recipesByProduct.set(row.product_id, list);
    }

    for (const item of items) {
      const recipeLines = recipesByProduct.get(item.productId);
      if (!recipeLines) continue;

      for (const line of recipeLines) {
        const quantityDelta = line.quantityPerUnit * item.quantity;

        await this.databaseService.execute<ResultSetHeader>(
          `UPDATE saas_joker_stock_items SET quantity = quantity - ? WHERE id = ?`,
          [quantityDelta, line.stockItemId]
        );

        if (quantityDelta !== 0) {
          await this.databaseService.execute<ResultSetHeader>(
            `INSERT INTO saas_joker_stock_movements (stock_item_id, product_id, product_name, order_id, quantity_delta, reason)
             VALUES (?, ?, ?, ?, ?, 'venta')`,
            [line.stockItemId, item.productId, item.productName || null, orderId ?? null, -quantityDelta]
          );
        }
      }
    }
  }

  private mapStockItem(row: JokerStockItemRow): JokerStockItem {
    return {
      id: row.id,
      name: row.name,
      unit: row.unit,
      category: row.category === "bebida" || row.category === "otro" ? row.category : "comida",
      quantity: Number(row.quantity),
      createdAt: toIsoString(row.created_at),
      updatedAt: toIsoString(row.updated_at)
    };
  }
}
