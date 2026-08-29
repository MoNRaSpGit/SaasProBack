import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CreateJokerAccountEntryDto } from "./dto/create-joker-account-entry.dto";
import { CreateJokerAccountPaymentDto } from "./dto/create-joker-account-payment.dto";
import { CreateJokerClientDto } from "./dto/create-joker-client.dto";
import { allocatePaymentFifo } from "./joker-account-payment.logic";
import { toIsoString } from "./joker.dateUtils";
import { JokerAccountEntry, JokerAccountPayment, JokerAccountPaymentCoveredEntry, JokerAccountSettlement, JokerClient } from "./joker.types";

type JokerClientRow = RowDataPacket & {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  created_at: string | Date;
};

// Exportado: JokerOrdersService lo usa para leer directo
// saas_joker_account_entries al sincronizar un pedido editado (ver
// syncAccountEntryForOrder), sin tener que inyectar todo este servicio
// solo para esa lectura puntual.
export type JokerAccountEntryRow = RowDataPacket & {
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

type JokerAccountPaymentRow = RowDataPacket & {
  id: number;
  client_id: number;
  amount: string | number;
  covered_entries: string | JokerAccountPaymentCoveredEntry[];
  created_at: string | Date;
  settled_at: string | Date | null;
};

@Injectable()
export class JokerAccountService implements OnModuleInit {
  private ensurePaymentsTablePromise: Promise<void> | null = null;

  constructor(private readonly databaseService: DatabaseService) {}

  async onModuleInit() {
    await this.ensurePaymentsTable();
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
    await this.closeOpenPayments(clientId);

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
    await this.closeOpenPayments(clientId);
    return { ok: true };
  }

  // Pago parcial (o total) de cuenta corriente. A diferencia de
  // settleAccount, NO toca las boletas (saas_joker_account_entries) para
  // nada -- solo registra el pago. El saldo del cliente nunca se guarda
  // como un numero suelto: siempre es "suma de boletas abiertas menos suma
  // de pagos abiertos", asi que nunca se puede desincronizar.
  //
  // coveredEntries es una fotografia (calculada aca mismo, por orden de
  // antiguedad de las boletas) de a que consumos correspondio este pago
  // puntual -- para que el historial diga "este pago de $500 cubrio la
  // boleta del 20/8 ($300) y parte de la del 22/8 ($200 de $400)", en vez
  // de solo un monto suelto.
  //
  // Si el pago cubre el saldo exacto (no se permite pagar de mas), se
  // considera "pago total": ahi si se archivan las boletas (igual que
  // settleAccount) y se cierran todos los pagos abiertos de este ciclo,
  // pero sin borrarlos -- quedan para siempre en el historial.
  async createAccountPayment(dto: CreateJokerAccountPaymentDto): Promise<{ item: JokerAccountPayment }> {
    await this.ensurePaymentsTable();

    const clientRows = await this.databaseService.query<JokerClientRow[]>(
      `SELECT id, name, phone, address, created_at FROM saas_joker_clients WHERE id = ? LIMIT 1`,
      [dto.clientId]
    );
    if (!clientRows[0]) {
      throw new NotFoundException("Cliente no encontrado");
    }

    const openEntries = await this.databaseService.query<JokerAccountEntryRow[]>(
      `SELECT id, client_id, order_id, total, items, created_at FROM saas_joker_account_entries WHERE client_id = ? ORDER BY created_at ASC`,
      [dto.clientId]
    );
    const openPayments = await this.databaseService.query<JokerAccountPaymentRow[]>(
      `SELECT id, client_id, amount, covered_entries, created_at, settled_at
       FROM saas_joker_account_payments
       WHERE client_id = ? AND settled_at IS NULL
       ORDER BY created_at ASC`,
      [dto.clientId]
    );

    const totalEntries = openEntries.reduce((sum, entry) => sum + Number(entry.total), 0);
    const totalPaidSoFar = openPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const balance = Math.round((totalEntries - totalPaidSoFar) * 100) / 100;

    if (dto.amount > balance) {
      throw new BadRequestException(`El pago no puede ser mayor al saldo pendiente ($${balance.toFixed(2)}).`);
    }

    const coveredEntries = allocatePaymentFifo(
      openEntries.map((entry) => ({ id: entry.id, orderId: entry.order_id, total: Number(entry.total) })),
      totalPaidSoFar,
      dto.amount
    );

    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_joker_account_payments (client_id, amount, covered_entries) VALUES (?, ?, ?)`,
      [dto.clientId, dto.amount, JSON.stringify(coveredEntries)]
    );

    const newBalance = Math.round((balance - dto.amount) * 100) / 100;
    if (newBalance <= 0) {
      await this.archiveClientEntries(dto.clientId, "pago");
      await this.closeOpenPayments(dto.clientId);
    }

    const rows = await this.databaseService.query<JokerAccountPaymentRow[]>(
      `SELECT id, client_id, amount, covered_entries, created_at, settled_at FROM saas_joker_account_payments WHERE id = ? LIMIT 1`,
      [result.insertId]
    );

    return { item: this.mapAccountPayment(rows[0]) };
  }

  // Cierra (settled_at = ahora) todos los pagos abiertos de un cliente sin
  // borrarlos -- pasa a llamarse cuando el ciclo termina en pago total
  // (createAccountPayment cuando cubre el saldo exacto, o settleAccount).
  private async closeOpenPayments(clientId: number): Promise<void> {
    await this.databaseService.execute(
      `UPDATE saas_joker_account_payments SET settled_at = NOW() WHERE client_id = ? AND settled_at IS NULL`,
      [clientId]
    );
  }

  // Todos los pagos de un cliente, abiertos y ya cerrados -- para el
  // historial permanente ("pago tanto tal fecha"), sin importar si el
  // ciclo que cubrian ya termino en pago total.
  async listAccountPaymentsForClient(clientId: number): Promise<{ items: JokerAccountPayment[] }> {
    await this.ensurePaymentsTable();
    const rows = await this.databaseService.query<JokerAccountPaymentRow[]>(
      `SELECT id, client_id, amount, covered_entries, created_at, settled_at
       FROM saas_joker_account_payments
       WHERE client_id = ?
       ORDER BY created_at DESC
       LIMIT 500`,
      [clientId]
    );
    return { items: rows.map((row) => this.mapAccountPayment(row)) };
  }

  // Solo los pagos abiertos (settled_at IS NULL), de todos los clientes --
  // es lo que necesita el listado de clientes para calcular "Debe $X" de
  // cada uno (boletas abiertas menos pagos abiertos), igual que ya hace
  // con accountEntries.
  async listOpenAccountPayments(): Promise<{ items: JokerAccountPayment[] }> {
    await this.ensurePaymentsTable();
    const rows = await this.databaseService.query<JokerAccountPaymentRow[]>(
      `SELECT id, client_id, amount, covered_entries, created_at, settled_at
       FROM saas_joker_account_payments
       WHERE settled_at IS NULL
       ORDER BY created_at DESC
       LIMIT 2000`
    );
    return { items: rows.map((row) => this.mapAccountPayment(row)) };
  }

  private async ensurePaymentsTable(): Promise<void> {
    if (!this.ensurePaymentsTablePromise) {
      this.ensurePaymentsTablePromise = this.createPaymentsTable().catch((error) => {
        this.ensurePaymentsTablePromise = null;
        throw error;
      });
    }
    await this.ensurePaymentsTablePromise;
  }

  private async createPaymentsTable(): Promise<void> {
    await this.databaseService.execute(
      `CREATE TABLE IF NOT EXISTS saas_joker_account_payments (
         id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
         client_id INT NOT NULL,
         amount DECIMAL(10,2) NOT NULL,
         covered_entries JSON NOT NULL,
         created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
         settled_at DATETIME NULL,
         PRIMARY KEY (id),
         KEY idx_saas_joker_account_payments_client (client_id, settled_at)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
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

  private mapClient(row: JokerClientRow): JokerClient {
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      address: row.address,
      createdAt: toIsoString(row.created_at)
    };
  }

  private mapAccountEntry(row: JokerAccountEntryRow): JokerAccountEntry {
    return {
      id: row.id,
      clientId: row.client_id,
      orderId: row.order_id,
      total: Number(row.total),
      items: typeof row.items === "string" ? JSON.parse(row.items) : row.items,
      createdAt: toIsoString(row.created_at),
      orderDate: row.order_date ? toIsoString(row.order_date).slice(0, 10) : null
    };
  }

  private mapAccountPayment(row: JokerAccountPaymentRow): JokerAccountPayment {
    return {
      id: row.id,
      clientId: row.client_id,
      amount: Number(row.amount),
      coveredEntries: typeof row.covered_entries === "string" ? JSON.parse(row.covered_entries) : row.covered_entries,
      createdAt: toIsoString(row.created_at),
      settledAt: row.settled_at ? toIsoString(row.settled_at) : null
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
      entryCreatedAt: toIsoString(row.entry_created_at),
      reason:
        row.reason === "cliente_eliminado" || row.reason === "correccion_manual" ? row.reason : "pago",
      settledAt: toIsoString(row.settled_at)
    };
  }
}
