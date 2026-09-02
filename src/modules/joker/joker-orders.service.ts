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
import { JokerOrder, JokerOrderOriginRole, JokerPaymentMethod, JokerRegisterState } from "./joker.types";

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
    // clearCourier manda por encima de courierId (no deberian venir los dos
    // juntos, pero si pasara, "sacaselo" gana): es el caso de pasar un
    // pedido que ya tenia delivery asignado a "Mostrador".
    const nextCourierId = dto.clearCourier ? null : dto.courierId !== undefined ? dto.courierId : existing.courier_id;
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
    const courierAssignedAtClause = dto.clearCourier ? "NULL" : dto.courierId !== undefined ? "CURRENT_TIMESTAMP" : "courier_assigned_at";

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
      // Incluye a "Mostrador" si esta habilitado (ver is_counter en
      // saas_joker_couriers) -- por eso el mensaje dice "habilitados" en
      // general, no "repartidores": Mostrador no es un repartidor.
      const names = activeCourierRows.map((row) => row.name).join(", ");
      throw new BadRequestException(`Liquida primero: ${names}`);
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

  // La caja del Usuario ya no es propia (saas_joker_user_register_state,
  // que el Usuario abria/cerraba solo) -- ahora "Mostrador" es una tarjeta
  // mas en Delivery, que solo el Administrador habilita/liquida (ver
  // JokerCourierService, columna is_counter en saas_joker_couriers). Los
  // pedidos del turno actual del Usuario se piden ahora con
  // listCurrentPeriodOrders(courierId) pasando el id de esa tarjeta -- ver
  // mas abajo, donde se rama por is_counter.

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
      const courierRows = await this.databaseService.query<
        Array<RowDataPacket & { active_since: string | Date | null; is_counter: number }>
      >(`SELECT active_since, is_counter FROM saas_joker_couriers WHERE id = ? LIMIT 1`, [courierId]);
      const activeSince = courierRows[0]?.active_since ?? null;
      if (!activeSince) {
        return { items: [] };
      }

      // "Mostrador" (is_counter=1, ver JokerCourierService) no es un
      // repartidor real: sus pedidos son los "de mostrador" en el sentido
      // amplio que se usa en toda la app -- nacieron del rol Usuario
      // (origin_role='usuario', ya aceptados) o el Administrador los cargo
      // el mismo y los marco "Mostrador" a mano (nombre con "MOSTRADOR",
      // ver PanelScreen#handleAssignCounter) -- en los dos casos, sin
      // repartidor asignado (si se le asigna uno, deja de ser mostrador y
      // pasa a ser puro del Administrador). No tienen courier_id ni
      // courier_assigned_at, asi que se ordena/filtra por created_at.
      const rows = courierRows[0]?.is_counter
        ? await this.databaseService.query<JokerOrderRow[]>(
            `SELECT ${ORDER_COLUMNS} FROM saas_joker_orders
             WHERE status = 'confirmado'
               AND courier_id IS NULL
               AND (origin_role = 'usuario' OR UPPER(customer_name) LIKE '%MOSTRADOR%')
               AND created_at > ?
             ORDER BY created_at DESC LIMIT 500`,
            [activeSince]
          )
        : await this.databaseService.query<JokerOrderRow[]>(
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
