import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { createSign } from "crypto";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { BulkApplyJokerRecipeDto } from "./dto/bulk-apply-joker-recipe.dto";
import { CloseJokerRegisterDto } from "./dto/close-joker-register.dto";
import { CreateJokerAccountEntryDto } from "./dto/create-joker-account-entry.dto";
import { CreateJokerClientDto } from "./dto/create-joker-client.dto";
import { CreateJokerCourierCashMovementDto } from "./dto/create-joker-courier-cash-movement.dto";
import { CreateJokerOrderDto, CreateJokerOrderItemDto } from "./dto/create-joker-order.dto";
import { CreateJokerProductDto } from "./dto/create-joker-product.dto";
import { CreateJokerStockItemDto } from "./dto/create-joker-stock-item.dto";
import { ListJokerOrdersDto } from "./dto/list-joker-orders.dto";
import { RestockJokerStockItemDto } from "./dto/restock-joker-stock-item.dto";
import { SetJokerProductRecipeDto } from "./dto/set-joker-product-recipe.dto";
import { SettleJokerCourierDto } from "./dto/settle-joker-courier.dto";
import { UpdateJokerCourierDto } from "./dto/update-joker-courier.dto";
import { UpdateJokerOrderDto } from "./dto/update-joker-order.dto";
import { UpdateJokerProductDto } from "./dto/update-joker-product.dto";
import { UpdateJokerStockItemDto } from "./dto/update-joker-stock-item.dto";
import {
  JokerAccountEntry,
  JokerAccountSettlement,
  JokerClient,
  JokerComboSlot,
  JokerCourier,
  JokerCourierCashMovement,
  JokerCourierCashSummary,
  JokerCourierSettlement,
  JokerOrder,
  JokerPaymentMethod,
  JokerProduct,
  JokerProductRecipeLine,
  JokerRegisterState,
  JokerStockItem
} from "./joker.types";

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

type JokerOrderRow = RowDataPacket & {
  id: number;
  display_number: number;
  total: string | number;
  address: string;
  payment_method: string;
  customer_name: string | null;
  items: string;
  created_at: string | Date;
  order_date: string | Date | null;
  courier_id: number | null;
  delivery_cost: string | number | null;
};

type JokerCourierRow = RowDataPacket & {
  id: number;
  name: string;
  status: "inactivo" | "activo";
  active_since: string | Date | null;
  created_at: string | Date;
};

type JokerCourierCashMovementRow = RowDataPacket & {
  id: number;
  courier_id: number;
  type: "inicial" | "gasto" | "entrega";
  amount: string | number;
  description: string | null;
  created_at: string | Date;
};

type JokerCourierSettlementRow = RowDataPacket & {
  id: number;
  courier_id: number;
  courier_name: string;
  initial_cash: string | number;
  orders_cash_total: string | number;
  orders_cash_count: number;
  expenses_total: string | number;
  handovers_total: string | number;
  cash_on_hand: string | number;
  movements: string | JokerCourierCashMovement[];
  hourly_rate: string | number;
  hours_worked: string | number;
  hours_total: string | number;
  delivery_cost_total: string | number;
  payout_total: string | number;
  active_since: string | Date | null;
  settled_at: string | Date;
};

type JokerRegisterStateRow = RowDataPacket & {
  is_open: number;
  last_closed_at: string | Date | null;
};

type JokerStockItemRow = RowDataPacket & {
  id: number;
  name: string;
  unit: string;
  category: string;
  quantity: string | number;
  created_at: string | Date;
  updated_at: string | Date;
};

type JokerProductRecipeRow = RowDataPacket & {
  stock_item_id: number;
  stock_item_name: string;
  unit: string;
  quantity_per_unit: string | number;
};

type JokerClientRow = RowDataPacket & {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  created_at: string | Date;
};

type JokerAccountEntryRow = RowDataPacket & {
  id: number;
  client_id: number;
  order_id: number | null;
  total: string | number;
  items: string;
  created_at: string | Date;
  order_date: string | Date | null;
};

type JokerAccountSettlementRow = RowDataPacket & {
  id: number;
  client_id: number;
  client_name: string;
  entry_id: number;
  total: string | number;
  items: string;
  entry_created_at: string | Date;
  reason: string;
  settled_at: string | Date;
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

const ORDER_COLUMNS = `
  id,
  display_number,
  total,
  address,
  payment_method,
  customer_name,
  items,
  created_at,
  order_date,
  courier_id,
  delivery_cost
`;

// El local (El Joker) opera en Montevideo (UTC-3); el "dia" del panel
// arranca y cierra a las 5am hora local (no a medianoche), para que un
// pedido despues de medianoche siga contando como parte del dia anterior.
const STORE_UTC_OFFSET_HOURS = 3;
const STORE_DAY_START_HOUR = 5;

@Injectable()
export class JokerService {
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

  async createProduct(dto: CreateJokerProductDto): Promise<{ item: JokerProduct }> {
    const name = dto.name.trim();
    const category = dto.category?.trim() || "Otros";

    const result = await this.databaseService.execute<ResultSetHeader>(
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

    const rows = await this.databaseService.query<JokerProductRow[]>(
      `SELECT ${PRODUCT_COLUMNS}
       FROM saas_joker_products
       WHERE id = ?
       LIMIT 1`,
      [result.insertId]
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

  async createOrder(dto: CreateJokerOrderDto): Promise<{ item: JokerOrder }> {
    const total = dto.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const displayNumber = await this.getNextOrderDisplayNumber();

    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_joker_orders (display_number, total, address, payment_method, customer_name, items, order_date, courier_id, delivery_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        displayNumber,
        total,
        dto.address?.trim() || "",
        dto.paymentMethod ?? "efectivo",
        dto.customerName?.trim() || null,
        JSON.stringify(dto.items),
        dto.orderDate?.trim() || null,
        dto.courierId ?? null,
        dto.deliveryCost ?? null
      ]
    );

    const rows = await this.databaseService.query<JokerOrderRow[]>(
      `SELECT ${ORDER_COLUMNS}
       FROM saas_joker_orders
       WHERE id = ?
       LIMIT 1`,
      [result.insertId]
    );

    await this.deductStockForOrderItems(dto.items, Number(result.insertId));

    return { item: this.mapOrder(rows[0]) };
  }

  // Edita un pedido ya cargado (ej: el cliente se bajo una coca). El total
  // se recalcula solo a partir de los items nuevos, nunca se edita a mano.
  // El stock se ajusta por la diferencia entre lo viejo y lo nuevo: si baja
  // una cantidad (o saca un producto entero), se lo devuelve al stock: si la
  // sube, descuenta la diferencia. Si el pedido queda sin items, total
  // queda en $0 (equivale a cancelarlo, pero no se borra el registro).
  async updateOrder(orderId: number, dto: UpdateJokerOrderDto): Promise<{ item: JokerOrder }> {
    const rows = await this.databaseService.query<JokerOrderRow[]>(
      `SELECT ${ORDER_COLUMNS} FROM saas_joker_orders WHERE id = ? LIMIT 1`,
      [orderId]
    );

    const existing = rows[0];
    if (!existing) {
      throw new NotFoundException("Pedido no encontrado");
    }

    const oldItems: CreateJokerOrderItemDto[] =
      typeof existing.items === "string" ? JSON.parse(existing.items) : (existing.items as unknown as CreateJokerOrderItemDto[]);

    const productNameById = new Map<number, string>();
    for (const item of [...oldItems, ...dto.items]) {
      productNameById.set(item.productId, item.productName);
    }

    const oldQtyByProduct = new Map<number, number>();
    for (const item of oldItems) {
      oldQtyByProduct.set(item.productId, (oldQtyByProduct.get(item.productId) ?? 0) + item.quantity);
    }

    const newQtyByProduct = new Map<number, number>();
    for (const item of dto.items) {
      newQtyByProduct.set(item.productId, (newQtyByProduct.get(item.productId) ?? 0) + item.quantity);
    }

    const productIds = new Set([...oldQtyByProduct.keys(), ...newQtyByProduct.keys()]);
    const deltaItems: CreateJokerOrderItemDto[] = [];
    for (const productId of productIds) {
      const delta = (newQtyByProduct.get(productId) ?? 0) - (oldQtyByProduct.get(productId) ?? 0);
      if (delta !== 0) {
        deltaItems.push({ productId, productName: productNameById.get(productId) ?? "", unitPrice: 0, quantity: delta });
      }
    }

    await this.deductStockForOrderItems(deltaItems, orderId);

    const total = dto.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const nextOrderDate = dto.orderDate !== undefined ? dto.orderDate.trim() || null : existing.order_date;
    const nextCourierId = dto.courierId !== undefined ? dto.courierId : existing.courier_id;
    const nextDeliveryCost = dto.deliveryCost !== undefined ? dto.deliveryCost : existing.delivery_cost;

    await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_joker_orders SET total = ?, items = ?, order_date = ?, courier_id = ?, delivery_cost = ? WHERE id = ?`,
      [total, JSON.stringify(dto.items), nextOrderDate, nextCourierId, nextDeliveryCost, orderId]
    );

    await this.syncAccountEntryForOrder(orderId, dto.items);

    const updatedRows = await this.databaseService.query<JokerOrderRow[]>(
      `SELECT ${ORDER_COLUMNS} FROM saas_joker_orders WHERE id = ? LIMIT 1`,
      [orderId]
    );

    return { item: this.mapOrder(updatedRows[0]) };
  }

  // Si el pedido editado tenia un movimiento de cuenta corriente asociado
  // (se vendio "a cuenta"), lo actualiza para que quede en sincro con los
  // items/total nuevos. Si el pedido quedo sin items (cancelado), el
  // movimiento se borra directamente. Si el pedido no era "a cuenta" no hay
  // ningun movimiento vinculado y no hace nada.
  private async syncAccountEntryForOrder(orderId: number, items: CreateJokerOrderItemDto[]): Promise<void> {
    const entryRows = await this.databaseService.query<JokerAccountEntryRow[]>(
      `SELECT id, client_id, order_id, total, items, created_at FROM saas_joker_account_entries WHERE order_id = ? LIMIT 1`,
      [orderId]
    );
    const entry = entryRows[0];
    if (!entry) return;

    if (!items.length) {
      await this.databaseService.execute<ResultSetHeader>(`DELETE FROM saas_joker_account_entries WHERE id = ?`, [entry.id]);
      return;
    }

    const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const entryItemsByProduct = new Map<string, number>();
    for (const item of items) {
      entryItemsByProduct.set(item.productName, (entryItemsByProduct.get(item.productName) ?? 0) + item.quantity);
    }
    const entryItems = [...entryItemsByProduct.entries()].map(([productName, quantity]) => ({ productName, quantity }));

    await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_joker_account_entries SET total = ?, items = ? WHERE id = ?`,
      [total, JSON.stringify(entryItems), entry.id]
    );
  }

  // Descuenta stock segun la receta de cada producto vendido (si no tiene
  // receta cargada, no se toca nada). No bloquea la venta si algun insumo
  // queda en negativo -- eso se avisa despues en la pantalla de Stock. Cada
  // descuento queda registrado en saas_joker_stock_movements, para poder
  // mostrar despues que producto se llevo cada insumo (ver
  // getStockItemConsumption).
  private async deductStockForOrderItems(items: CreateJokerOrderItemDto[], orderId?: number): Promise<void> {
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
        createdAt: this.toIsoString(row.last_created_at)
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

  private mapStockItem(row: JokerStockItemRow): JokerStockItem {
    return {
      id: row.id,
      name: row.name,
      unit: row.unit,
      category: row.category === "bebida" || row.category === "otro" ? row.category : "comida",
      quantity: Number(row.quantity),
      createdAt: this.toIsoString(row.created_at),
      updatedAt: this.toIsoString(row.updated_at)
    };
  }

  private mapRecipeLine(row: JokerProductRecipeRow): JokerProductRecipeLine {
    return {
      stockItemId: row.stock_item_id,
      stockItemName: row.stock_item_name,
      unit: row.unit,
      quantityPerUnit: Number(row.quantity_per_unit)
    };
  }

  // El numero que se imprime en el ticket ("Pedido #N") arranca de nuevo en
  // 1 despues de cada cierre de caja: cuenta los pedidos desde el ultimo
  // cierre (o desde siempre, si todavia no hubo ninguno). Se guarda fijo en
  // el pedido al crearlo, no se recalcula despues (para que cierres futuros
  // no le cambien el numero a pedidos viejos).
  private async getNextOrderDisplayNumber(): Promise<number> {
    const stateRows = await this.databaseService.query<JokerRegisterStateRow[]>(
      `SELECT last_closed_at FROM saas_joker_register_state WHERE id = 1 LIMIT 1`
    );
    const lastClosedAt = stateRows[0]?.last_closed_at ?? null;

    const countRows = await this.databaseService.query<RowDataPacket[]>(
      lastClosedAt
        ? `SELECT COUNT(*) AS cnt FROM saas_joker_orders WHERE created_at > ?`
        : `SELECT COUNT(*) AS cnt FROM saas_joker_orders`,
      lastClosedAt ? [lastClosedAt] : []
    );

    return Number(countRows[0].cnt) + 1;
  }

  async getRegisterState(): Promise<JokerRegisterState> {
    const rows = await this.databaseService.query<JokerRegisterStateRow[]>(
      `SELECT is_open, last_closed_at FROM saas_joker_register_state WHERE id = 1 LIMIT 1`
    );
    const row = rows[0];

    return {
      isOpen: row ? Boolean(row.is_open) : true,
      lastClosedAt: row?.last_closed_at ? this.toIsoString(row.last_closed_at) : null
    };
  }

  async openRegister(): Promise<JokerRegisterState> {
    await this.databaseService.execute<ResultSetHeader>(`UPDATE saas_joker_register_state SET is_open = 1 WHERE id = 1`);
    return this.getRegisterState();
  }

  // Guarda un registro historico del cierre (para poder consultarlo mas
  // adelante) y marca la caja como cerrada; el proximo pedido que se cree
  // vuelve a arrancar la numeracion en 1.
  async closeRegister(dto: CloseJokerRegisterDto): Promise<JokerRegisterState> {
    const activeCourierRows = await this.databaseService.query<Array<RowDataPacket & { name: string }>>(
      `SELECT name FROM saas_joker_couriers WHERE status = 'activo' ORDER BY id ASC`
    );
    if (activeCourierRows.length) {
      const names = activeCourierRows.map((row) => row.name).join(", ");
      throw new BadRequestException(`Liquida primero a los repartidores habilitados: ${names}`);
    }

    await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_joker_register_closes (closed_at, total_vendido, ganancia, payment_totals, ranking)
       VALUES (CURRENT_TIMESTAMP, ?, ?, ?, ?)`,
      [dto.totalVendido, dto.ganancia, JSON.stringify(dto.paymentTotals), JSON.stringify(dto.ranking)]
    );

    await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_joker_register_state SET is_open = 0, last_closed_at = CURRENT_TIMESTAMP WHERE id = 1`
    );

    return this.getRegisterState();
  }

  async listOrders(dto: ListJokerOrdersDto): Promise<{ items: JokerOrder[] }> {
    const dateLabel = dto.date ? String(dto.date).slice(0, 10) : this.getStoreDateLabel();
    const { startIso, endIso } = this.buildStoreDayRangeUtc(dateLabel);

    const rows = await this.databaseService.query<JokerOrderRow[]>(
      dto.courierId
        ? `SELECT ${ORDER_COLUMNS}
           FROM saas_joker_orders
           WHERE created_at >= ? AND created_at < ? AND courier_id = ?
           ORDER BY created_at DESC
           LIMIT 500`
        : `SELECT ${ORDER_COLUMNS}
           FROM saas_joker_orders
           WHERE created_at >= ? AND created_at < ?
           ORDER BY created_at DESC
           LIMIT 500`,
      dto.courierId ? [startIso, endIso, dto.courierId] : [startIso, endIso]
    );

    return { items: rows.map((row) => this.mapOrder(row)) };
  }

  async listCouriers(): Promise<{ items: JokerCourier[] }> {
    const rows = await this.databaseService.query<JokerCourierRow[]>(
      `SELECT id, name, status, active_since, created_at FROM saas_joker_couriers ORDER BY id ASC`
    );

    return { items: rows.map((row) => this.mapCourier(row)) };
  }

  async updateCourier(courierId: number, dto: UpdateJokerCourierDto): Promise<{ item: JokerCourier }> {
    const result = await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_joker_couriers SET name = ? WHERE id = ?`,
      [dto.name.trim(), courierId]
    );

    if (!result.affectedRows) {
      throw new NotFoundException("Repartidor no encontrado");
    }

    return this.getCourierById(courierId);
  }

  // "Habilitar": arranca un turno nuevo para el repartidor -- desde este
  // momento sus pedidos asignados y su caja empiezan a contar de nuevo
  // (ver active_since en getCourierCashSummary/listCurrentPeriodOrders).
  async enableCourier(courierId: number): Promise<{ item: JokerCourier }> {
    const result = await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_joker_couriers SET status = 'activo', active_since = CURRENT_TIMESTAMP WHERE id = ?`,
      [courierId]
    );

    if (!result.affectedRows) {
      throw new NotFoundException("Repartidor no encontrado");
    }

    return this.getCourierById(courierId);
  }

  // "Liquidar": cierra el turno del repartidor (equivalente a un cierre de
  // caja, pero individual) -- antes de resetear, archiva una copia
  // permanente de la caja y de la liquidacion (horas + envios = total a
  // pagar) del turno en saas_joker_courier_settlements (igual que
  // archiveClientEntries para cuenta corriente), por si despues hay que
  // revisar o reclamar algo. Vuelve a quedar inactivo y su caja/pedidos
  // del proximo turno arrancan de nuevo desde 0 cuando se lo vuelva a
  // habilitar. El cierre de caja general no se puede hacer mientras haya
  // repartidores habilitados sin liquidar (ver closeRegister).
  async settleCourier(courierId: number, dto?: SettleJokerCourierDto): Promise<{ item: JokerCourier }> {
    const courierRows = await this.databaseService.query<JokerCourierRow[]>(
      `SELECT id, name, status, active_since, created_at FROM saas_joker_couriers WHERE id = ? LIMIT 1`,
      [courierId]
    );
    const courier = courierRows[0];
    if (!courier) {
      throw new NotFoundException("Repartidor no encontrado");
    }

    if (courier.active_since) {
      const summary = await this.getCourierCashSummary(courierId);
      const activeSince = courier.active_since;

      const orderRows = await this.databaseService.query<Array<RowDataPacket & { delivery_cost: string | number | null }>>(
        `SELECT delivery_cost FROM saas_joker_orders WHERE courier_id = ? AND created_at > ?`,
        [courierId, activeSince]
      );
      const deliveryCostTotal = orderRows.reduce((sum, row) => sum + Number(row.delivery_cost || 0), 0);
      const hourlyRate = dto?.hourlyRate ?? 120;
      const hoursWorked = dto?.hoursWorked ?? 5;
      const hoursTotal = hourlyRate * hoursWorked;
      const payoutTotal = hoursTotal + deliveryCostTotal;

      await this.databaseService.withTransaction(async (connection) => {
        await connection.execute(
          `INSERT INTO saas_joker_courier_settlements
             (courier_id, courier_name, initial_cash, orders_cash_total, orders_cash_count, expenses_total, handovers_total, cash_on_hand, movements,
              hourly_rate, hours_worked, hours_total, delivery_cost_total, payout_total, active_since)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            courierId,
            courier.name,
            summary.initialCash,
            summary.ordersCashTotal,
            summary.ordersCashCount,
            summary.expensesTotal,
            summary.handoversTotal,
            summary.cashOnHand,
            JSON.stringify(summary.movements),
            hourlyRate,
            hoursWorked,
            hoursTotal,
            deliveryCostTotal,
            payoutTotal,
            activeSince
          ]
        );

        await connection.execute(`DELETE FROM saas_joker_courier_cash_movements WHERE courier_id = ? AND created_at > ?`, [
          courierId,
          activeSince
        ]);

        await connection.execute(`UPDATE saas_joker_couriers SET status = 'inactivo', active_since = NULL WHERE id = ?`, [
          courierId
        ]);
      });

      return this.getCourierById(courierId);
    }

    const result = await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_joker_couriers SET status = 'inactivo', active_since = NULL WHERE id = ?`,
      [courierId]
    );

    if (!result.affectedRows) {
      throw new NotFoundException("Repartidor no encontrado");
    }

    return this.getCourierById(courierId);
  }

  // Historial permanente de turnos liquidados de un repartidor, para
  // revisar o reclamar algo despues (sobrevive aunque el turno ya se haya
  // reseteado). Mismo patron que listAccountSettlements para clientes.
  async listCourierSettlements(courierId: number): Promise<{ items: JokerCourierSettlement[] }> {
    const rows = await this.databaseService.query<JokerCourierSettlementRow[]>(
      `SELECT id, courier_id, courier_name, initial_cash, orders_cash_total, orders_cash_count, expenses_total, handovers_total, cash_on_hand, movements,
              hourly_rate, hours_worked, hours_total, delivery_cost_total, payout_total, active_since, settled_at
       FROM saas_joker_courier_settlements
       WHERE courier_id = ?
       ORDER BY settled_at DESC
       LIMIT 200`,
      [courierId]
    );

    return { items: rows.map((row) => this.mapCourierSettlement(row)) };
  }

  private mapCourierSettlement(row: JokerCourierSettlementRow): JokerCourierSettlement {
    const movements: JokerCourierCashMovement[] = typeof row.movements === "string" ? JSON.parse(row.movements) : row.movements;

    return {
      id: Number(row.id),
      courierId: Number(row.courier_id),
      courierName: row.courier_name,
      initialCash: Number(row.initial_cash),
      ordersCashTotal: Number(row.orders_cash_total),
      ordersCashCount: Number(row.orders_cash_count),
      expensesTotal: Number(row.expenses_total),
      handoversTotal: Number(row.handovers_total),
      cashOnHand: Number(row.cash_on_hand),
      movements,
      hourlyRate: Number(row.hourly_rate),
      hoursWorked: Number(row.hours_worked),
      hoursTotal: Number(row.hours_total),
      deliveryCostTotal: Number(row.delivery_cost_total),
      payoutTotal: Number(row.payout_total),
      activeSince: row.active_since ? this.toIsoString(row.active_since) : null,
      settledAt: this.toIsoString(row.settled_at)
    };
  }

  private async getCourierById(courierId: number): Promise<{ item: JokerCourier }> {
    const rows = await this.databaseService.query<JokerCourierRow[]>(
      `SELECT id, name, status, active_since, created_at FROM saas_joker_couriers WHERE id = ? LIMIT 1`,
      [courierId]
    );

    const row = rows[0];
    if (!row) {
      throw new NotFoundException("Repartidor no encontrado");
    }

    return { item: this.mapCourier(row) };
  }

  private mapCourier(row: JokerCourierRow): JokerCourier {
    return {
      id: Number(row.id),
      name: row.name,
      status: row.status === "activo" ? "activo" : "inactivo",
      activeSince: row.active_since ? this.toIsoString(row.active_since) : null
    };
  }

  // Solo se puede cargar caja mientras el repartidor esta habilitado: si
  // estuviera inactivo (active_since null), el movimiento quedaria
  // guardado pero invisible para siempre, porque getCourierCashSummary no
  // consulta nada cuando no hay turno abierto.
  async addCourierCashMovement(
    courierId: number,
    dto: CreateJokerCourierCashMovementDto
  ): Promise<{ item: JokerCourierCashSummary }> {
    const courierRows = await this.databaseService.query<JokerCourierRow[]>(
      `SELECT id, name, status, active_since, created_at FROM saas_joker_couriers WHERE id = ? LIMIT 1`,
      [courierId]
    );
    const courier = courierRows[0];
    if (!courier) {
      throw new NotFoundException("Repartidor no encontrado");
    }
    if (courier.status !== "activo") {
      throw new BadRequestException("El repartidor no esta habilitado");
    }

    await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_joker_courier_cash_movements (courier_id, type, amount, description) VALUES (?, ?, ?, ?)`,
      [courierId, dto.type, dto.amount, dto.description?.trim() || null]
    );

    return { item: await this.getCourierCashSummary(courierId) };
  }

  // Caja del repartidor en el turno actual: desde que se lo habilito por
  // ultima vez (active_since), lo que arranco llevando + el efectivo
  // cobrado en los pedidos "efectivo" que reparte, menos lo que gasto
  // comprando para el local y lo que ya entrego. Si no esta habilitado
  // (active_since null) no tiene turno abierto, asi que la caja arranca
  // en 0.
  async getCourierCashSummary(courierId: number): Promise<JokerCourierCashSummary> {
    const courierRows = await this.databaseService.query<JokerCourierRow[]>(
      `SELECT id, name, status, active_since, created_at FROM saas_joker_couriers WHERE id = ? LIMIT 1`,
      [courierId]
    );
    const activeSince = courierRows[0]?.active_since ?? null;

    if (!activeSince) {
      return { initialCash: 0, ordersCashTotal: 0, ordersCashCount: 0, expensesTotal: 0, handoversTotal: 0, cashOnHand: 0, movements: [] };
    }

    const movementRows = await this.databaseService.query<JokerCourierCashMovementRow[]>(
      `SELECT id, courier_id, type, amount, description, created_at
       FROM saas_joker_courier_cash_movements
       WHERE courier_id = ? AND created_at > ?
       ORDER BY created_at ASC`,
      [courierId, activeSince]
    );

    const orderRows = await this.databaseService.query<Array<RowDataPacket & { total: string | number }>>(
      `SELECT total FROM saas_joker_orders WHERE courier_id = ? AND payment_method = 'efectivo' AND created_at > ?`,
      [courierId, activeSince]
    );

    const initialCash = movementRows.filter((row) => row.type === "inicial").reduce((sum, row) => sum + Number(row.amount), 0);
    const expensesTotal = movementRows.filter((row) => row.type === "gasto").reduce((sum, row) => sum + Number(row.amount), 0);
    const handoversTotal = movementRows.filter((row) => row.type === "entrega").reduce((sum, row) => sum + Number(row.amount), 0);
    const ordersCashTotal = orderRows.reduce((sum, row) => sum + Number(row.total), 0);
    const cashOnHand = initialCash + ordersCashTotal - expensesTotal - handoversTotal;

    return {
      initialCash,
      ordersCashTotal,
      ordersCashCount: orderRows.length,
      expensesTotal,
      handoversTotal,
      cashOnHand,
      movements: movementRows
        .filter((row) => row.type !== "inicial")
        .map((row) => ({
          id: Number(row.id),
          type: row.type,
          amount: Number(row.amount),
          description: row.description,
          createdAt: this.toIsoString(row.created_at)
        }))
        .reverse()
    };
  }

  async deleteAllOrders(): Promise<{ ok: true }> {
    await this.databaseService.execute<ResultSetHeader>(`DELETE FROM saas_joker_orders`);
    return { ok: true };
  }

  // Pedidos del periodo de caja actual (desde el ultimo cierre, o todos si
  // todavia no hubo ninguno). Lo usa el Panel para que el resumen (vendido,
  // ganancia, ranking) arranque de nuevo despues de cada cierre, en vez de
  // seguir sumando todo el dia calendario. Delivery usa el mismo metodo
  // (con courierId), pero ahi el periodo es el turno del repartidor
  // (active_since, desde que se lo habilito por ultima vez) en vez del
  // cierre de caja general, para que arranque de nuevo cada vez que se
  // habilita/liquida y no solo con el cierre.
  async listCurrentPeriodOrders(courierId?: number): Promise<{ items: JokerOrder[] }> {
    if (courierId) {
      const courierRows = await this.databaseService.query<JokerCourierRow[]>(
        `SELECT active_since FROM saas_joker_couriers WHERE id = ? LIMIT 1`,
        [courierId]
      );
      const activeSince = courierRows[0]?.active_since ?? null;
      if (!activeSince) {
        return { items: [] };
      }

      const rows = await this.databaseService.query<JokerOrderRow[]>(
        `SELECT ${ORDER_COLUMNS} FROM saas_joker_orders WHERE courier_id = ? AND created_at > ? ORDER BY created_at DESC LIMIT 500`,
        [courierId, activeSince]
      );
      return { items: rows.map((row) => this.mapOrder(row)) };
    }

    const stateRows = await this.databaseService.query<JokerRegisterStateRow[]>(
      `SELECT last_closed_at FROM saas_joker_register_state WHERE id = 1 LIMIT 1`
    );
    const lastClosedAt = stateRows[0]?.last_closed_at ?? null;

    const rows = await this.databaseService.query<JokerOrderRow[]>(
      lastClosedAt
        ? `SELECT ${ORDER_COLUMNS} FROM saas_joker_orders WHERE created_at > ? ORDER BY created_at DESC LIMIT 500`
        : `SELECT ${ORDER_COLUMNS} FROM saas_joker_orders ORDER BY created_at DESC LIMIT 500`,
      lastClosedAt ? [lastClosedAt] : []
    );

    return { items: rows.map((row) => this.mapOrder(row)) };
  }

  async listClients(): Promise<{ items: JokerClient[] }> {
    const rows = await this.databaseService.query<JokerClientRow[]>(
      `SELECT id, name, phone, address, created_at
       FROM saas_joker_clients
       ORDER BY name ASC
       LIMIT 1000`
    );

    return { items: rows.map((row) => this.mapClient(row)) };
  }

  async createClient(dto: CreateJokerClientDto): Promise<{ item: JokerClient }> {
    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_joker_clients (name, phone, address) VALUES (?, ?, ?)`,
      [dto.name.trim(), dto.phone?.trim() || null, dto.address?.trim() || null]
    );

    const rows = await this.databaseService.query<JokerClientRow[]>(
      `SELECT id, name, phone, address, created_at FROM saas_joker_clients WHERE id = ? LIMIT 1`,
      [result.insertId]
    );

    return { item: this.mapClient(rows[0]) };
  }

  async deleteClient(clientId: number): Promise<{ ok: true }> {
    // Si el cliente tenia consumos pendientes, se archivan antes de borrar
    // (el borrado de saas_joker_account_entries es en cascada por FK, asi
    // que si no los archivamos antes se pierden para siempre).
    await this.archiveClientEntries(clientId, "cliente_eliminado");

    const result = await this.databaseService.execute<ResultSetHeader>(
      `DELETE FROM saas_joker_clients WHERE id = ?`,
      [clientId]
    );

    if (result.affectedRows === 0) {
      throw new NotFoundException("Cliente no encontrado");
    }

    return { ok: true };
  }

  // La fecha del movimiento sigue la fecha "logica" del pedido vinculado
  // (order_date) si tiene una editada a mano; si no, la fecha real en la
  // que se cargo. Por eso el join con saas_joker_orders en vez de guardar
  // una copia de la fecha en el propio movimiento (que quedaria vieja si
  // el pedido se edita despues).
  async listAccountEntries(): Promise<{ items: JokerAccountEntry[] }> {
    const rows = await this.databaseService.query<JokerAccountEntryRow[]>(
      `SELECT e.id, e.client_id, e.order_id, e.total, e.items, e.created_at, o.order_date
       FROM saas_joker_account_entries e
       LEFT JOIN saas_joker_orders o ON o.id = e.order_id
       ORDER BY e.created_at DESC
       LIMIT 2000`
    );

    return { items: rows.map((row) => this.mapAccountEntry(row)) };
  }

  async createAccountEntry(dto: CreateJokerAccountEntryDto): Promise<{ item: JokerAccountEntry }> {
    const clientRows = await this.databaseService.query<JokerClientRow[]>(
      `SELECT id, name, phone, address, created_at FROM saas_joker_clients WHERE id = ? LIMIT 1`,
      [dto.clientId]
    );

    if (!clientRows[0]) {
      throw new NotFoundException("Cliente no encontrado");
    }

    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_joker_account_entries (client_id, order_id, total, items) VALUES (?, ?, ?, ?)`,
      [dto.clientId, dto.orderId ?? null, dto.total, JSON.stringify(dto.items)]
    );

    const rows = await this.databaseService.query<JokerAccountEntryRow[]>(
      `SELECT e.id, e.client_id, e.order_id, e.total, e.items, e.created_at, o.order_date
       FROM saas_joker_account_entries e
       LEFT JOIN saas_joker_orders o ON o.id = e.order_id
       WHERE e.id = ? LIMIT 1`,
      [result.insertId]
    );

    return { item: this.mapAccountEntry(rows[0]) };
  }

  // "Pago": salda la cuenta de un cliente puntual, sin borrar al cliente.
  // Antes de borrar el historial, se archiva una copia permanente en
  // saas_joker_account_settlements por si despues hay que reclamar algo.
  async settleAccount(clientId: number): Promise<{ ok: true }> {
    await this.archiveClientEntries(clientId, "pago");
    return { ok: true };
  }

  // Copia cada consumo pendiente del cliente a saas_joker_account_settlements
  // y recien despues lo borra de saas_joker_account_entries, todo en una
  // transaccion (si el archivado falla, no se pierde nada). No hace nada si
  // el cliente no tiene consumos pendientes.
  private async archiveClientEntries(clientId: number, reason: "pago" | "cliente_eliminado"): Promise<void> {
    const clientRows = await this.databaseService.query<JokerClientRow[]>(
      `SELECT id, name, phone, address, created_at FROM saas_joker_clients WHERE id = ? LIMIT 1`,
      [clientId]
    );
    const clientName = clientRows[0]?.name ?? "Cliente eliminado";

    const entryRows = await this.databaseService.query<JokerAccountEntryRow[]>(
      `SELECT id, client_id, total, items, created_at FROM saas_joker_account_entries WHERE client_id = ?`,
      [clientId]
    );

    if (!entryRows.length) return;

    await this.databaseService.withTransaction(async (connection) => {
      for (const entry of entryRows) {
        // mysql2 a veces ya deserializa la columna JSON a objeto (no
        // siempre string), asi que hay que normalizar antes de reinsertar.
        const itemsJson = typeof entry.items === "string" ? entry.items : JSON.stringify(entry.items);
        await connection.execute(
          `INSERT INTO saas_joker_account_settlements
             (client_id, client_name, entry_id, total, items, entry_created_at, reason)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [clientId, clientName, entry.id, entry.total, itemsJson, entry.created_at, reason]
        );
      }

      await connection.execute(`DELETE FROM saas_joker_account_entries WHERE client_id = ?`, [clientId]);
    });
  }

  // Historial permanente de pagos/eliminaciones de un cliente, para
  // reclamos ("el cliente dice que no debia eso"). Sobrevive aunque el
  // cliente se haya borrado despues.
  async listAccountSettlements(clientId: number): Promise<{ items: JokerAccountSettlement[] }> {
    const rows = await this.databaseService.query<JokerAccountSettlementRow[]>(
      `SELECT id, client_id, client_name, entry_id, total, items, entry_created_at, reason, settled_at
       FROM saas_joker_account_settlements
       WHERE client_id = ?
       ORDER BY settled_at DESC
       LIMIT 500`,
      [clientId]
    );

    return { items: rows.map((row) => this.mapAccountSettlement(row)) };
  }

  // Certificado publico + firma para que QZ Tray confie en el sitio sin
  // mostrar el cartel de "Signature (missing) / Validity (invalid)" en
  // cada conexion. QZ_CERTIFICATE y QZ_PRIVATE_KEY se generaron una sola
  // vez con openssl y se guardan como variables de entorno (el PEM con
  // los saltos de linea reemplazados por "\n" literal).
  getQzCertificate(): string {
    const certificate = process.env.QZ_CERTIFICATE;
    if (!certificate) {
      throw new BadRequestException("QZ_CERTIFICATE no esta configurado en el servidor.");
    }
    return certificate.replace(/\\n/g, "\n");
  }

  signQzRequest(toSign: string): { signature: string } {
    const privateKey = process.env.QZ_PRIVATE_KEY;
    if (!privateKey) {
      throw new BadRequestException("QZ_PRIVATE_KEY no esta configurado en el servidor.");
    }

    const sign = createSign("RSA-SHA512");
    sign.update(toSign);
    sign.end();
    const signature = sign.sign(privateKey.replace(/\\n/g, "\n"), "base64");

    return { signature };
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
      createdAt: this.toIsoString(row.created_at),
      updatedAt: this.toIsoString(row.updated_at),
      comboSlots: comboSlots?.length ? comboSlots : undefined
    };
  }

  private mapOrder(row: JokerOrderRow): JokerOrder {
    return {
      id: row.id,
      displayNumber: row.display_number,
      total: Number(row.total),
      address: row.address,
      paymentMethod: this.toPaymentMethod(row.payment_method),
      customerName: row.customer_name,
      items: typeof row.items === "string" ? JSON.parse(row.items) : row.items,
      createdAt: this.toIsoString(row.created_at),
      orderDate: row.order_date ? this.toIsoString(row.order_date).slice(0, 10) : null,
      courierId: row.courier_id,
      deliveryCost: row.delivery_cost === null || row.delivery_cost === undefined ? null : Number(row.delivery_cost)
    };
  }

  private mapAccountSettlement(row: JokerAccountSettlementRow): JokerAccountSettlement {
    return {
      id: row.id,
      clientId: row.client_id,
      clientName: row.client_name,
      entryId: row.entry_id,
      total: Number(row.total),
      items: typeof row.items === "string" ? JSON.parse(row.items) : row.items,
      entryCreatedAt: this.toIsoString(row.entry_created_at),
      reason:
        row.reason === "cliente_eliminado" || row.reason === "correccion_manual" ? row.reason : "pago",
      settledAt: this.toIsoString(row.settled_at)
    };
  }

  private mapClient(row: JokerClientRow): JokerClient {
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      address: row.address,
      createdAt: this.toIsoString(row.created_at)
    };
  }

  private mapAccountEntry(row: JokerAccountEntryRow): JokerAccountEntry {
    return {
      id: row.id,
      clientId: row.client_id,
      orderId: row.order_id,
      total: Number(row.total),
      items: typeof row.items === "string" ? JSON.parse(row.items) : row.items,
      createdAt: this.toIsoString(row.created_at),
      orderDate: row.order_date ? this.toIsoString(row.order_date).slice(0, 10) : null
    };
  }

  private toPaymentMethod(value: string): JokerPaymentMethod {
    return value === "tarjeta" || value === "transferencia" || value === "cuenta" ? value : "efectivo";
  }

  private getStoreDateLabel(date = new Date()) {
    const shifted = new Date(date.getTime() - STORE_DAY_START_HOUR * 60 * 60 * 1000);
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Montevideo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(shifted);
  }

  private buildStoreDayRangeUtc(dateLabel: string) {
    const match = String(dateLabel || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      throw new BadRequestException("La fecha debe tener formato YYYY-MM-DD.");
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const start = new Date(Date.UTC(year, month - 1, day, STORE_UTC_OFFSET_HOURS + STORE_DAY_START_HOUR, 0, 0));
    const end = new Date(Date.UTC(year, month - 1, day + 1, STORE_UTC_OFFSET_HOURS + STORE_DAY_START_HOUR, 0, 0));

    return {
      startIso: start.toISOString().slice(0, 19).replace("T", " "),
      endIso: end.toISOString().slice(0, 19).replace("T", " ")
    };
  }

  private toIsoString(value: string | Date) {
    return value instanceof Date ? value.toISOString() : value;
  }
}
