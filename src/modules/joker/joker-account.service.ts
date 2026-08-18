import { Injectable, NotFoundException } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CreateJokerAccountEntryDto } from "./dto/create-joker-account-entry.dto";
import { CreateJokerClientDto } from "./dto/create-joker-client.dto";
import { toIsoString } from "./joker.dateUtils";
import { JokerAccountEntry, JokerAccountSettlement, JokerClient } from "./joker.types";

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

@Injectable()
export class JokerAccountService {
  constructor(private readonly databaseService: DatabaseService) {}

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
