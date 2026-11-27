import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PoolConnection } from "mysql2/promise";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CreatePilotoAccountEntryDto } from "./dto/create-piloto-account-entry.dto";
import { CreatePilotoClientDto } from "./dto/create-piloto-client.dto";
import { CreatePilotoCreditSaleDto, CreatePilotoAccountPaymentDto } from "./dto/create-piloto-credit.dto";
import { PilotoService } from "./piloto.service";
import { PilotoAccountEntry, PilotoAccountPayment, PilotoClient } from "./piloto.types";

type PilotoClientRow = RowDataPacket & {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  created_at: string | Date;
  deleted_at: string | Date | null;
};

type PilotoAccountEntryRow = RowDataPacket & {
  id: number;
  client_id: number;
  sale_id: number | null;
  total: string | number;
  items: string;
  created_at: string | Date;
  closed_by_payment_id: number | null;
  voided_at: string | Date | null;
};

type PilotoAccountPaymentRow = RowDataPacket & {
  id: number;
  client_id: number;
  amount: string | number;
  created_at: string | Date;
  closed_by_payment_id: number | null;
  voided_at: string | Date | null;
};

function toIsoString(value: string | Date) {
  return value instanceof Date ? value.toISOString() : value;
}

function mapClient(row: PilotoClientRow): PilotoClient {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    address: row.address,
    createdAt: toIsoString(row.created_at),
    deletedAt: row.deleted_at ? toIsoString(row.deleted_at) : null
  };
}

function mapAccountEntry(row: PilotoAccountEntryRow): PilotoAccountEntry {
  const items = typeof row.items === "string" ? JSON.parse(row.items) : row.items;
  return {
    id: row.id,
    clientId: row.client_id,
    saleId: row.sale_id,
    total: Number(row.total),
    items: items ?? [],
    createdAt: toIsoString(row.created_at),
    closedByPaymentId: row.closed_by_payment_id,
    voided: row.voided_at !== null
  };
}

function mapPayment(row: PilotoAccountPaymentRow): PilotoAccountPayment {
  return {
    id: row.id,
    clientId: row.client_id,
    amount: Number(row.amount),
    createdAt: toIsoString(row.created_at),
    closedByPaymentId: row.closed_by_payment_id,
    voided: row.voided_at !== null
  };
}

// Las cuentas de plata se comparan en centesimos (enteros).
const toCents = (value: string | number) => Math.round(Number(value) * 100);

// "Abierto" = todavia forma parte de la cuenta que se ve en pantalla.
const OPEN = "closed_by_payment_id IS NULL AND voided_at IS NULL";

// Clientes / cuenta corriente de Piloto (rehecho el 27/11/2026, pedido
// explicito: "que quede el historial, que no haya inconsistencias").
//  - La cuenta es una lista de movimientos: boletas (fiados) y pagos.
//  - El saldo SIEMPRE se calcula de esa lista, nunca se guarda aparte.
//  - Nada se borra: cuando un pago deja la cuenta en cero, todo lo abierto
//    queda cerrado por ese pago y solo se ve en el historial.
//  - Cada escritura bloquea primero la fila del cliente, asi dos
//    dispositivos no pueden pisarse el saldo.
@Injectable()
export class PilotoClientsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly pilotoService: PilotoService
  ) {}

  async listClients(): Promise<PilotoClient[]> {
    const rows = await this.databaseService.query<PilotoClientRow[]>(
      `SELECT * FROM saas_piloto_clients WHERE deleted_at IS NULL ORDER BY name ASC`
    );
    return rows.map(mapClient);
  }

  async createClient(dto: CreatePilotoClientDto): Promise<PilotoClient> {
    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_piloto_clients (name, phone, address) VALUES (?, ?, ?)`,
      [dto.name.trim(), dto.phone?.trim() || null, dto.address?.trim() || null]
    );
    const rows = await this.databaseService.query<PilotoClientRow[]>(
      `SELECT * FROM saas_piloto_clients WHERE id = ?`,
      [result.insertId]
    );
    return mapClient(rows[0]);
  }

  // Borrado logico: sale de la lista pero queda en el historial. Nunca si
  // todavia hay saldo.
  async deleteClient(clientId: number): Promise<PilotoClient> {
    return this.databaseService.withTransaction(async (connection) => {
      const client = await this.lockClient(connection, clientId);
      if ((await this.balanceCents(connection, clientId)) !== 0) {
        throw new BadRequestException("No se puede borrar: el cliente todavía tiene saldo en la cuenta.");
      }
      await connection.execute(`UPDATE saas_piloto_clients SET deleted_at = NOW() WHERE id = ?`, [clientId]);
      return client;
    });
  }

  async listAccountEntries(clientId?: number): Promise<PilotoAccountEntry[]> {
    const rows = await this.databaseService.query<PilotoAccountEntryRow[]>(
      `SELECT * FROM saas_piloto_account_entries WHERE ${OPEN} ${clientId ? "AND client_id = ?" : ""} ORDER BY created_at DESC, id DESC`,
      clientId ? [clientId] : []
    );
    return rows.map(mapAccountEntry);
  }

  async listPayments(): Promise<PilotoAccountPayment[]> {
    const rows = await this.databaseService.query<PilotoAccountPaymentRow[]>(
      `SELECT * FROM saas_piloto_account_payments WHERE ${OPEN} ORDER BY created_at DESC, id DESC`
    );
    return rows.map(mapPayment);
  }

  // Todo lo que paso, incluso cuentas ya saldadas y clientes borrados.
  async getHistory(): Promise<{ clients: PilotoClient[]; entries: PilotoAccountEntry[]; payments: PilotoAccountPayment[] }> {
    const [clients, entries, payments] = await Promise.all([
      this.databaseService.query<PilotoClientRow[]>(`SELECT * FROM saas_piloto_clients ORDER BY name ASC`),
      this.databaseService.query<PilotoAccountEntryRow[]>(`SELECT * FROM saas_piloto_account_entries ORDER BY created_at ASC, id ASC`),
      this.databaseService.query<PilotoAccountPaymentRow[]>(`SELECT * FROM saas_piloto_account_payments ORDER BY created_at ASC, id ASC`)
    ]);
    return { clients: clients.map(mapClient), entries: entries.map(mapAccountEntry), payments: payments.map(mapPayment) };
  }

  // Camino viejo (venta y boleta en dos pasos): lo usa solo una pantalla que
  // todavia no se actualizo.
  async createAccountEntry(dto: CreatePilotoAccountEntryDto): Promise<PilotoAccountEntry> {
    return this.databaseService.withTransaction(async (connection) => {
      await this.lockClient(connection, dto.clientId);
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO saas_piloto_account_entries (client_id, sale_id, total, items) VALUES (?, ?, ?, ?)`,
        [dto.clientId, dto.saleId ?? null, dto.total, JSON.stringify(dto.items)]
      );
      return this.getEntry(connection, result.insertId);
    });
  }

  // Fiar: la venta y la boleta se guardan juntas o no se guarda nada.
  async createCreditSale(dto: CreatePilotoCreditSaleDto): Promise<{ item: PilotoAccountEntry; clientName: string; duplicated: boolean }> {
    return this.databaseService.withTransaction(async (connection) => {
      const client = await this.lockClient(connection, dto.clientId);

      const [previous] = await connection.execute<PilotoAccountEntryRow[]>(
        `SELECT * FROM saas_piloto_account_entries WHERE request_id = ?`,
        [dto.requestId]
      );
      if (previous[0]) {
        if (previous[0].client_id !== dto.clientId) {
          throw new ConflictException("Esa venta ya se anotó a otro cliente.");
        }
        return { item: mapAccountEntry(previous[0]), clientName: client.name, duplicated: true };
      }

      const sale = await this.pilotoService.insertSale(connection, { paymentMethod: "credito", items: dto.items });
      const items = dto.items.map((item) => ({ productName: item.name.trim(), quantity: item.quantity, unitPrice: item.price }));
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO saas_piloto_account_entries (client_id, sale_id, total, items, request_id) VALUES (?, ?, ?, ?, ?)`,
        [dto.clientId, sale.id, sale.totalAmount, JSON.stringify(items), dto.requestId]
      );
      return { item: await this.getEntry(connection, result.insertId), clientName: client.name, duplicated: false };
    });
  }

  // Pago total o parcial. settle = "Saldar cuenta": el monto tiene que ser
  // exactamente el saldo (si cambio mientras tanto, se avisa y no se cobra).
  async registerPayment(dto: CreatePilotoAccountPaymentDto) {
    return this.databaseService.withTransaction(async (connection) => {
      const client = await this.lockClient(connection, dto.clientId);
      const amountCents = toCents(dto.amount);

      const [previous] = await connection.execute<PilotoAccountPaymentRow[]>(
        `SELECT * FROM saas_piloto_account_payments WHERE request_id = ?`,
        [dto.requestId]
      );
      if (previous[0]) {
        if (previous[0].client_id !== dto.clientId || toCents(previous[0].amount) !== amountCents) {
          throw new ConflictException("Ese pago ya estaba registrado con otros datos. Revisá la cuenta.");
        }
        const balanceAfter = (await this.balanceCents(connection, dto.clientId)) / 100;
        return { payment: mapPayment(previous[0]), clientName: client.name, balanceAfter, duplicated: true };
      }

      const balance = await this.balanceCents(connection, dto.clientId);
      if (balance <= 0) {
        throw new ConflictException("La cuenta ya está en cero.");
      }
      if (dto.settle && amountCents !== balance) {
        throw new ConflictException(`La cuenta cambió: ahora debe $${balance / 100}. Revisá y volvé a intentar.`);
      }
      if (amountCents > balance) {
        throw new BadRequestException(`El pago no puede ser mayor a lo que debe ($${balance / 100}).`);
      }

      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO saas_piloto_account_payments (client_id, amount, request_id) VALUES (?, ?, ?)`,
        [dto.clientId, amountCents / 100, dto.requestId]
      );
      const paymentId = result.insertId;

      if (amountCents === balance) {
        for (const table of ["saas_piloto_account_entries", "saas_piloto_account_payments"]) {
          await connection.execute(
            `UPDATE ${table} SET closed_by_payment_id = ? WHERE client_id = ? AND closed_by_payment_id IS NULL`,
            [paymentId, dto.clientId]
          );
        }
      }

      const [rows] = await connection.execute<PilotoAccountPaymentRow[]>(`SELECT * FROM saas_piloto_account_payments WHERE id = ?`, [
        paymentId
      ]);
      return { payment: mapPayment(rows[0]), clientName: client.name, balanceAfter: (balance - amountCents) / 100, duplicated: false };
    });
  }

  // Camino viejo de "Saldar cuenta" (pantallas sin actualizar): ahora
  // registra el pago del total en vez de borrar.
  async settleAccount(clientId: number) {
    const [{ balance }] = await this.databaseService.query<(RowDataPacket & { balance: string })[]>(
      `SELECT
         (SELECT COALESCE(SUM(total), 0) FROM saas_piloto_account_entries WHERE client_id = ? AND ${OPEN}) -
         (SELECT COALESCE(SUM(amount), 0) FROM saas_piloto_account_payments WHERE client_id = ? AND ${OPEN}) AS balance`,
      [clientId, clientId]
    );
    if (toCents(balance) <= 0) return null;
    return this.registerPayment({ clientId, amount: Number(balance), requestId: randomUUID(), settle: true });
  }

  private async lockClient(connection: PoolConnection, clientId: number): Promise<PilotoClient> {
    const [rows] = await connection.execute<PilotoClientRow[]>(
      `SELECT * FROM saas_piloto_clients WHERE id = ? AND deleted_at IS NULL FOR UPDATE`,
      [clientId]
    );
    if (!rows[0]) {
      throw new NotFoundException("Cliente no encontrado.");
    }
    return mapClient(rows[0]);
  }

  private async balanceCents(connection: PoolConnection, clientId: number): Promise<number> {
    const [rows] = await connection.execute<(RowDataPacket & { charged: string; paid: string })[]>(
      `SELECT
         (SELECT COALESCE(SUM(total), 0) FROM saas_piloto_account_entries WHERE client_id = ? AND ${OPEN}) AS charged,
         (SELECT COALESCE(SUM(amount), 0) FROM saas_piloto_account_payments WHERE client_id = ? AND ${OPEN}) AS paid`,
      [clientId, clientId]
    );
    return toCents(rows[0].charged) - toCents(rows[0].paid);
  }

  private async getEntry(connection: PoolConnection, entryId: number): Promise<PilotoAccountEntry> {
    const [rows] = await connection.execute<PilotoAccountEntryRow[]>(`SELECT * FROM saas_piloto_account_entries WHERE id = ?`, [entryId]);
    return mapAccountEntry(rows[0]);
  }
}
