import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CreateJokerOrderDto, CreateJokerOrderItemDto } from "./dto/create-joker-order.dto";
import { CloseJokerRegisterDto } from "./dto/close-joker-register.dto";
import { OpenJokerUserRegisterDto } from "./dto/open-joker-user-register.dto";
import { ListJokerOrdersDto } from "./dto/list-joker-orders.dto";
import { UpdateJokerOrderDto } from "./dto/update-joker-order.dto";
import { buildStoreDayRangeUtc, getStoreDateLabel, toIsoString } from "./joker.dateUtils";
import { JokerStockService } from "./joker-stock.service";
import { JokerAccountEntryRow } from "./joker-account.service";
import { JokerOrder, JokerOrderOriginRole, JokerPaymentMethod, JokerRegisterState, JokerUserRegisterState } from "./joker.types";

type JokerOrderRow = RowDataPacket & {
  id: number;
  display_number: number | null;
  status: string;
  origin_role: string;
  total: string | number;
  address: string;
  payment_method: string;
  customer_name: string | null;
  client_id: number | null;
  items: string;
  created_at: string | Date;
  order_date: string | Date | null;
  courier_id: number | null;
  courier_assigned_at: string | Date | null;
  delivery_cost: string | number | null;
};

type JokerRegisterStateRow = RowDataPacket & {
  is_open: number;
  last_closed_at: string | Date | null;
};

type JokerUserRegisterStateRow = RowDataPacket & {
  is_open: number;
  initial_cash: string | number | null;
  opened_at: string | Date | null;
  last_closed_at: string | Date | null;
};

const ORDER_COLUMNS = `
  id,
  display_number,
  status,
  origin_role,
  total,
  address,
  payment_method,
  customer_name,
  client_id,
  items,
  created_at,
  order_date,
  courier_id,
  courier_assigned_at,
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

    // courier_assigned_at usa CURRENT_TIMESTAMP de SQL (no un Date de JS
    // como parametro): la sesion de esta base corre con una zona horaria
    // distinta a la del proceso Node, y comparar un Date de JS contra
    // active_since (que si se guarda con CURRENT_TIMESTAMP) quedaba
    // desfasado por horas, rompiendo el filtro "pedido asignado durante
    // el turno actual".
    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_joker_orders (display_number, status, origin_role, total, address, payment_method, customer_name, client_id, items, order_date, courier_id, courier_assigned_at, delivery_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${dto.courierId ? "CURRENT_TIMESTAMP" : "NULL"}, ?)`,
      [
        displayNumber,
        isPending ? "pendiente" : "confirmado",
        isPending ? "usuario" : "administrador",
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
    const nextPaymentMethod = dto.paymentMethod ?? existing.payment_method;
    const nextCustomerName = dto.customerName !== undefined ? dto.customerName.trim() || null : existing.customer_name;
    // Se recalcula cada vez que se manda un courierId (aunque sea el mismo
    // repartidor de nuevo): es lo que usan listCurrentPeriodOrders y
    // getCourierCashSummary para decidir si el pedido es "del turno
    // actual" del repartidor, en vez de comparar contra el created_at
    // original del pedido (que podia ser de antes de que se lo habilitara,
    // dejando el pedido invisible para el aunque se lo acabara de asignar).
    // CURRENT_TIMESTAMP de SQL, no un Date de JS como parametro -- ver
    // comentario en createOrder sobre el desfasaje de zona horaria.
    const courierAssignedAtClause = dto.courierId !== undefined ? "CURRENT_TIMESTAMP" : "courier_assigned_at";

    const switchingIntoCuenta = dto.paymentMethod === "cuenta" && existing.payment_method !== "cuenta";
    const switchingOutOfCuenta = dto.paymentMethod !== undefined && dto.paymentMethod !== "cuenta" && existing.payment_method === "cuenta";

    if (switchingIntoCuenta && !dto.clientId) {
      throw new BadRequestException("Para pasar a cuenta corriente hay que elegir un cliente");
    }

    const nextClientId = switchingIntoCuenta ? dto.clientId! : existing.client_id;

    await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_joker_orders SET total = ?, items = ?, order_date = ?, courier_id = ?, courier_assigned_at = ${courierAssignedAtClause}, delivery_cost = ?, payment_method = ?, client_id = ?, customer_name = ? WHERE id = ?`,
      [total, JSON.stringify(dto.items), nextOrderDate, nextCourierId, nextDeliveryCost, nextPaymentMethod, nextClientId, nextCustomerName, orderId]
    );

    // Tres caminos, sin pisarse entre si:
    // - Si el pedido dejo de ser "a cuenta" (se corrigio a efectivo/tarjeta/
    //   transferencia), el movimiento de cuenta corriente vinculado ya no
    //   corresponde -- se borra, igual que al cancelar el pedido entero.
    // - Si el pedido PASA a ser "a cuenta" (correccion rapida desde el
    //   Panel, antes bloqueada), se crea el movimiento -- mismo mecanismo
    //   que un pedido nuevo armado "a cuenta" desde Pedidos.
    // - Si sigue igual (era y sigue sin ser "a cuenta", o era y sigue
    //   siendo "a cuenta"), se sincroniza el movimiento existente (si hay)
    //   con los items/total nuevos.
    if (switchingOutOfCuenta) {
      await this.databaseService.execute<ResultSetHeader>(`DELETE FROM saas_joker_account_entries WHERE order_id = ?`, [
        orderId
      ]);
    } else if (switchingIntoCuenta && dto.items.length) {
      await this.databaseService.execute<ResultSetHeader>(
        `INSERT INTO saas_joker_account_entries (client_id, order_id, total, items) VALUES (?, ?, ?, ?)`,
        [nextClientId, orderId, total, JSON.stringify(this.groupItemsForAccountEntry(dto.items))]
      );
    } else if (!switchingIntoCuenta) {
      await this.syncAccountEntryForOrder(orderId, dto.items);
    }

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

    await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_joker_account_entries SET total = ?, items = ? WHERE id = ?`,
      [total, JSON.stringify(this.groupItemsForAccountEntry(items)), entry.id]
    );
  }

  // Un movimiento de cuenta corriente guarda los items agrupados por
  // nombre de producto (sin productId, a diferencia del pedido). Si el
  // mismo producto aparece en mas de una linea (ej. se agrego dos veces con
  // precios distintos por una promo), el precio unitario que queda es el
  // promedio ponderado: asi quantity * unitPrice sigue dando el total real
  // de ese producto. Usado tanto al crear el movimiento (pedido pasa a
  // "cuenta") como al resincronizarlo (pedido "a cuenta" editado).
  private groupItemsForAccountEntry(
    items: CreateJokerOrderItemDto[]
  ): Array<{ productName: string; quantity: number; unitPrice: number }> {
    const byProduct = new Map<string, { quantity: number; lineTotal: number }>();
    for (const item of items) {
      const group = byProduct.get(item.productName) ?? { quantity: 0, lineTotal: 0 };
      byProduct.set(item.productName, {
        quantity: group.quantity + item.quantity,
        lineTotal: group.lineTotal + item.unitPrice * item.quantity
      });
    }
    return [...byProduct.entries()].map(([productName, group]) => ({
      productName,
      quantity: group.quantity,
      unitPrice: group.lineTotal / group.quantity
    }));
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

  // Caja propia del Usuario (saas_joker_user_register_state), separada de
  // la caja global de arriba. A diferencia de esa, arranca cerrada y
  // necesita un monto inicial para poder abrirse.
  async getUserRegisterState(): Promise<JokerUserRegisterState> {
    const rows = await this.databaseService.query<JokerUserRegisterStateRow[]>(
      `SELECT is_open, initial_cash, opened_at, last_closed_at FROM saas_joker_user_register_state WHERE id = 1 LIMIT 1`
    );
    const row = rows[0];

    return {
      isOpen: row ? Boolean(row.is_open) : false,
      initialCash: row?.initial_cash === null || row?.initial_cash === undefined ? null : Number(row.initial_cash),
      openedAt: row?.opened_at ? toIsoString(row.opened_at) : null,
      lastClosedAt: row?.last_closed_at ? toIsoString(row.last_closed_at) : null
    };
  }

  async openUserRegister(dto: OpenJokerUserRegisterDto): Promise<JokerUserRegisterState> {
    await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_joker_user_register_state SET is_open = 1, initial_cash = ?, opened_at = CURRENT_TIMESTAMP WHERE id = 1`,
      [dto.initialCash]
    );
    return this.getUserRegisterState();
  }

  // Igual que closeRegister, pero sin el chequeo de repartidores (esa caja
  // es del Administrador, no tiene nada que ver con la del Usuario) y
  // guardando ademas el monto inicial con el que abrio, para el historico.
  async closeUserRegister(dto: CloseJokerRegisterDto): Promise<JokerUserRegisterState> {
    const state = await this.getUserRegisterState();
    if (!state.isOpen) {
      throw new BadRequestException("La caja del Usuario no esta abierta.");
    }

    await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_joker_user_register_closes (closed_at, initial_cash, total_vendido, ganancia, payment_totals, ranking)
       VALUES (CURRENT_TIMESTAMP, ?, ?, ?, ?, ?)`,
      [state.initialCash ?? 0, dto.totalVendido, dto.ganancia, JSON.stringify(dto.paymentTotals), JSON.stringify(dto.ranking)]
    );

    await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_joker_user_register_state SET is_open = 0, initial_cash = NULL, opened_at = NULL, last_closed_at = CURRENT_TIMESTAMP WHERE id = 1`
    );

    return this.getUserRegisterState();
  }

  // Pedidos del turno actual de la caja del Usuario (desde que la abrio),
  // solo los que el nacieron ahi (origin_role = 'usuario') -- un pedido
  // pendiente que el Usuario mando y el Administrador acepto durante este
  // turno cuenta igual, porque acceptOrder pisa created_at con el momento
  // de la aceptacion. Si la caja esta cerrada, no hay turno que mostrar.
  async listCurrentPeriodOrdersForUser(): Promise<{ items: JokerOrder[] }> {
    // Ojo aca: usar el opened_at CRUDO de la fila (Date de mysql2, misma
    // zona horaria de la sesion de la base), no el que devuelve
    // getUserRegisterState() ya convertido a ISO -- comparar ese ISO
    // (interpretado como UTC) contra un DATETIME de una sesion en otro
    // huso quedaba desfasado por horas (mismo problema que ya paso una vez
    // con active_since de los repartidores).
    const stateRows = await this.databaseService.query<JokerUserRegisterStateRow[]>(
      `SELECT is_open, opened_at FROM saas_joker_user_register_state WHERE id = 1 LIMIT 1`
    );
    const state = stateRows[0];
    if (!state || !state.is_open || !state.opened_at) {
      return { items: [] };
    }

    const rows = await this.databaseService.query<JokerOrderRow[]>(
      `SELECT ${ORDER_COLUMNS} FROM saas_joker_orders WHERE status = 'confirmado' AND origin_role = 'usuario' AND created_at > ? ORDER BY created_at DESC LIMIT 500`,
      [state.opened_at]
    );

    return { items: rows.map((row) => this.mapOrder(row)) };
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
        `SELECT ${ORDER_COLUMNS} FROM saas_joker_orders WHERE status = 'confirmado' AND courier_id = ? AND courier_assigned_at > ? ORDER BY courier_assigned_at DESC LIMIT 500`,
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
      originRole: row.origin_role as JokerOrderOriginRole,
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
