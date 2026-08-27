import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CreateJokerOrderDto, CreateJokerOrderItemDto } from "./dto/create-joker-order.dto";
import { CloseJokerRegisterDto } from "./dto/close-joker-register.dto";
import { ListJokerOrdersDto } from "./dto/list-joker-orders.dto";
import { UpdateJokerOrderDto } from "./dto/update-joker-order.dto";
import { buildStoreDayRangeUtc, getStoreDateLabel, toIsoString } from "./joker.dateUtils";
import { JokerStockService } from "./joker-stock.service";
import { JokerAccountEntryRow } from "./joker-account.service";
import { JokerOrder, JokerPaymentMethod, JokerRegisterState } from "./joker.types";

type JokerOrderRow = RowDataPacket & {
  id: number;
  display_number: number | null;
  status: string;
  total: string | number;
  address: string;
  payment_method: string;
  customer_name: string | null;
  client_id: number | null;
  items: string;
  created_at: string | Date;
  order_date: string | Date | null;
  courier_id: number | null;
  delivery_cost: string | number | null;
};

type JokerRegisterStateRow = RowDataPacket & {
  is_open: number;
  last_closed_at: string | Date | null;
};

const ORDER_COLUMNS = `
  id,
  display_number,
  status,
  total,
  address,
  payment_method,
  customer_name,
  client_id,
  items,
  created_at,
  order_date,
  courier_id,
  delivery_cost
`;

@Injectable()
export class JokerOrdersService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly stockService: JokerStockService
  ) {}

  async createOrder(dto: CreateJokerOrderDto): Promise<{ item: JokerOrder }> {
    const total = dto.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const isPending = dto.pending === true;
    // Un pedido pendiente todavia no "entro" a cocina: no se le asigna
    // numero (eso pasaria fuera de orden si el admin tarda en aceptarlo) ni
    // se descuenta stock (para no reservar/oversell mientras espera). Las
    // dos cosas se hacen recien en acceptOrder.
    const displayNumber = isPending ? null : await this.getNextOrderDisplayNumber();

    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_joker_orders (display_number, status, total, address, payment_method, customer_name, client_id, items, order_date, courier_id, delivery_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        displayNumber,
        isPending ? "pendiente" : "confirmado",
        total,
        dto.address?.trim() || "",
        dto.paymentMethod ?? "efectivo",
        dto.customerName?.trim() || null,
        dto.clientId ?? null,
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

    if (!isPending) {
      await this.stockService.deductStockForOrderItems(dto.items, Number(result.insertId));
    }

    return { item: this.mapOrder(rows[0]) };
  }

  // Pedidos de mostrador en espera de que el Administrador los acepte o
  // rechace. Se listan todos (no solo del periodo actual) porque un
  // pedido pendiente puede haber quedado de antes de un cierre de caja.
  async listPendingOrders(): Promise<{ items: JokerOrder[] }> {
    const rows = await this.databaseService.query<JokerOrderRow[]>(
      `SELECT ${ORDER_COLUMNS} FROM saas_joker_orders WHERE status = 'pendiente' ORDER BY created_at ASC LIMIT 100`
    );
    return { items: rows.map((row) => this.mapOrder(row)) };
  }

  // Acepta un pedido pendiente: recien aca se le asigna el numero real de
  // cocina (el siguiente disponible EN ESE MOMENTO, no el que le hubiera
  // tocado al crearse) y se descuenta el stock. created_at se actualiza a
  // ahora para que aparezca en su lugar cronologico real en el panel y en
  // los listados de delivery/movimientos, no en el momento en que se
  // mando desde el mostrador.
  async acceptOrder(orderId: number): Promise<{ item: JokerOrder }> {
    const rows = await this.databaseService.query<JokerOrderRow[]>(
      `SELECT ${ORDER_COLUMNS} FROM saas_joker_orders WHERE id = ? LIMIT 1`,
      [orderId]
    );
    const existing = rows[0];
    if (!existing) {
      throw new NotFoundException("Pedido no encontrado");
    }
    if (existing.status !== "pendiente") {
      throw new BadRequestException("Este pedido ya no esta pendiente.");
    }

    const displayNumber = await this.getNextOrderDisplayNumber();
    await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_joker_orders SET display_number = ?, status = 'confirmado', created_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [displayNumber, orderId]
    );

    const items: CreateJokerOrderItemDto[] =
      typeof existing.items === "string" ? JSON.parse(existing.items) : (existing.items as unknown as CreateJokerOrderItemDto[]);
    await this.stockService.deductStockForOrderItems(items, orderId);

    const updatedRows = await this.databaseService.query<JokerOrderRow[]>(
      `SELECT ${ORDER_COLUMNS} FROM saas_joker_orders WHERE id = ? LIMIT 1`,
      [orderId]
    );
    return { item: this.mapOrder(updatedRows[0]) };
  }

  // Rechaza un pedido pendiente: queda archivado con status 'rechazado'
  // (no se borra, para que quede registro de que paso), sin numero de
  // cocina ni descuento de stock.
  async rejectOrder(orderId: number): Promise<{ item: JokerOrder }> {
    const rows = await this.databaseService.query<JokerOrderRow[]>(
      `SELECT ${ORDER_COLUMNS} FROM saas_joker_orders WHERE id = ? LIMIT 1`,
      [orderId]
    );
    const existing = rows[0];
    if (!existing) {
      throw new NotFoundException("Pedido no encontrado");
    }
    if (existing.status !== "pendiente") {
      throw new BadRequestException("Este pedido ya no esta pendiente.");
    }

    await this.databaseService.execute<ResultSetHeader>(`UPDATE saas_joker_orders SET status = 'rechazado' WHERE id = ?`, [
      orderId
    ]);

    const updatedRows = await this.databaseService.query<JokerOrderRow[]>(
      `SELECT ${ORDER_COLUMNS} FROM saas_joker_orders WHERE id = ? LIMIT 1`,
      [orderId]
    );
    return { item: this.mapOrder(updatedRows[0]) };
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

    await this.stockService.deductStockForOrderItems(deltaItems, orderId);

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
  // ningun movimiento vinculado y no hace nada. Toca saas_joker_account_entries
  // directo (en vez de inyectar JokerAccountService) porque es una
  // actualizacion mecanica ligada 1 a 1 con la edicion del pedido, no logica
  // de cuenta corriente en si.
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
    // Si el mismo producto aparece en mas de una linea (ej. se agrego dos
    // veces con precios distintos por una promo), el precio unitario que
    // queda es el promedio ponderado: asi quantity * unitPrice sigue dando
    // el total real de ese producto.
    const entryItemsByProduct = new Map<string, { quantity: number; lineTotal: number }>();
    for (const item of items) {
      const existingGroup = entryItemsByProduct.get(item.productName) ?? { quantity: 0, lineTotal: 0 };
      entryItemsByProduct.set(item.productName, {
        quantity: existingGroup.quantity + item.quantity,
        lineTotal: existingGroup.lineTotal + item.unitPrice * item.quantity
      });
    }
    const entryItems = [...entryItemsByProduct.entries()].map(([productName, group]) => ({
      productName,
      quantity: group.quantity,
      unitPrice: group.lineTotal / group.quantity
    }));

    await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_joker_account_entries SET total = ?, items = ? WHERE id = ?`,
      [total, JSON.stringify(entryItems), entry.id]
    );
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
        ? `SELECT COUNT(*) AS cnt FROM saas_joker_orders WHERE status = 'confirmado' AND created_at > ?`
        : `SELECT COUNT(*) AS cnt FROM saas_joker_orders WHERE status = 'confirmado'`,
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
      lastClosedAt: row?.last_closed_at ? toIsoString(row.last_closed_at) : null
    };
  }

  async openRegister(): Promise<JokerRegisterState> {
    await this.databaseService.execute<ResultSetHeader>(`UPDATE saas_joker_register_state SET is_open = 1 WHERE id = 1`);
    return this.getRegisterState();
  }

  // Guarda un registro historico del cierre (para poder consultarlo mas
  // adelante) y marca la caja como cerrada; el proximo pedido que se cree
  // vuelve a arrancar la numeracion en 1. Chequea repartidores habilitados
  // directo contra saas_joker_couriers (en vez de inyectar
  // JokerCourierService) porque es solo una lectura de bloqueo, no logica
  // de repartidores en si.
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
    const dateLabel = dto.date ? String(dto.date).slice(0, 10) : getStoreDateLabel();
    const { startIso, endIso } = buildStoreDayRangeUtc(dateLabel);

    const rows = await this.databaseService.query<JokerOrderRow[]>(
      dto.courierId
        ? `SELECT ${ORDER_COLUMNS}
           FROM saas_joker_orders
           WHERE status = 'confirmado' AND created_at >= ? AND created_at < ? AND courier_id = ?
           ORDER BY created_at DESC
           LIMIT 500`
        : `SELECT ${ORDER_COLUMNS}
           FROM saas_joker_orders
           WHERE status = 'confirmado' AND created_at >= ? AND created_at < ?
           ORDER BY created_at DESC
           LIMIT 500`,
      dto.courierId ? [startIso, endIso, dto.courierId] : [startIso, endIso]
    );

    return { items: rows.map((row) => this.mapOrder(row)) };
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
      const courierRows = await this.databaseService.query<Array<RowDataPacket & { active_since: string | Date | null }>>(
        `SELECT active_since FROM saas_joker_couriers WHERE id = ? LIMIT 1`,
        [courierId]
      );
      const activeSince = courierRows[0]?.active_since ?? null;
      if (!activeSince) {
        return { items: [] };
      }

      const rows = await this.databaseService.query<JokerOrderRow[]>(
        `SELECT ${ORDER_COLUMNS} FROM saas_joker_orders WHERE status = 'confirmado' AND courier_id = ? AND created_at > ? ORDER BY created_at DESC LIMIT 500`,
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
        ? `SELECT ${ORDER_COLUMNS} FROM saas_joker_orders WHERE status = 'confirmado' AND created_at > ? ORDER BY created_at DESC LIMIT 500`
        : `SELECT ${ORDER_COLUMNS} FROM saas_joker_orders WHERE status = 'confirmado' ORDER BY created_at DESC LIMIT 500`,
      lastClosedAt ? [lastClosedAt] : []
    );

    return { items: rows.map((row) => this.mapOrder(row)) };
  }

  private toPaymentMethod(value: string): JokerPaymentMethod {
    return value === "tarjeta" || value === "transferencia" || value === "cuenta" ? value : "efectivo";
  }

  private mapOrder(row: JokerOrderRow): JokerOrder {
    return {
      id: row.id,
      displayNumber: row.display_number,
      status: row.status as JokerOrder["status"],
      total: Number(row.total),
      address: row.address,
      paymentMethod: this.toPaymentMethod(row.payment_method),
      customerName: row.customer_name,
      clientId: row.client_id,
      items: typeof row.items === "string" ? JSON.parse(row.items) : row.items,
      createdAt: toIsoString(row.created_at),
      orderDate: row.order_date ? toIsoString(row.order_date).slice(0, 10) : null,
      courierId: row.courier_id,
      deliveryCost: row.delivery_cost === null || row.delivery_cost === undefined ? null : Number(row.delivery_cost)
    };
  }
}
