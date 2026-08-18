import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CreateJokerCourierCashMovementDto } from "./dto/create-joker-courier-cash-movement.dto";
import { SettleJokerCourierDto } from "./dto/settle-joker-courier.dto";
import { UpdateJokerCourierDto } from "./dto/update-joker-courier.dto";
import { toIsoString } from "./joker.dateUtils";
import { JokerCourier, JokerCourierCashMovement, JokerCourierCashSummary, JokerCourierSettlement } from "./joker.types";

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

@Injectable()
export class JokerCourierService {
  constructor(private readonly databaseService: DatabaseService) {}

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
  // repartidores habilitados sin liquidar (ver JokerOrdersService.closeRegister).
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
          createdAt: toIsoString(row.created_at)
        }))
        .reverse()
    };
  }

  private mapCourier(row: JokerCourierRow): JokerCourier {
    return {
      id: Number(row.id),
      name: row.name,
      status: row.status === "activo" ? "activo" : "inactivo",
      activeSince: row.active_since ? toIsoString(row.active_since) : null
    };
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
      activeSince: row.active_since ? toIsoString(row.active_since) : null,
      settledAt: toIsoString(row.settled_at)
    };
  }
}
