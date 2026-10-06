import { Injectable } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CreatePilotoAccountEntryDto } from "./dto/create-piloto-account-entry.dto";
import { CreatePilotoClientDto } from "./dto/create-piloto-client.dto";
import { PilotoAccountEntry, PilotoClient } from "./piloto.types";

type PilotoClientRow = RowDataPacket & {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  created_at: string | Date;
};

type PilotoAccountEntryRow = RowDataPacket & {
  id: number;
  client_id: number;
  sale_id: number | null;
  total: string | number;
  items: string;
  created_at: string | Date;
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
    createdAt: toIsoString(row.created_at)
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
    createdAt: toIsoString(row.created_at)
  };
}

// Clientes / cuenta corriente de Piloto (06/10/2026, pedido explicito:
// "venta a credito... armar toda la parte del cliente, similar a la de
// Joker, pero plan basico"). Version simple a proposito (confirmado con
// el usuario): sin pagos parciales ni archivo historico -- cada venta a
// credito queda como una "boleta" (account entry) y "saldar cuenta" las
// borra todas de una. El saldo del cliente es simplemente la suma de sus
// boletas abiertas, nunca un numero guardado aparte.
@Injectable()
export class PilotoClientsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listClients(): Promise<PilotoClient[]> {
    const rows = await this.databaseService.query<PilotoClientRow[]>(
      `SELECT * FROM saas_piloto_clients ORDER BY name ASC`
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

  async deleteClient(clientId: number): Promise<void> {
    // ON DELETE CASCADE en saas_piloto_account_entries se lleva sus
    // boletas abiertas tambien -- version simple, sin archivo historico.
    await this.databaseService.execute(`DELETE FROM saas_piloto_clients WHERE id = ?`, [clientId]);
  }

  async listAccountEntries(clientId?: number): Promise<PilotoAccountEntry[]> {
    const rows = clientId
      ? await this.databaseService.query<PilotoAccountEntryRow[]>(
          `SELECT * FROM saas_piloto_account_entries WHERE client_id = ? ORDER BY created_at DESC`,
          [clientId]
        )
      : await this.databaseService.query<PilotoAccountEntryRow[]>(
          `SELECT * FROM saas_piloto_account_entries ORDER BY created_at DESC`
        );
    return rows.map(mapAccountEntry);
  }

  async createAccountEntry(dto: CreatePilotoAccountEntryDto): Promise<PilotoAccountEntry> {
    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_piloto_account_entries (client_id, sale_id, total, items) VALUES (?, ?, ?, ?)`,
      [dto.clientId, dto.saleId ?? null, dto.total, JSON.stringify(dto.items)]
    );
    const rows = await this.databaseService.query<PilotoAccountEntryRow[]>(
      `SELECT * FROM saas_piloto_account_entries WHERE id = ?`,
      [result.insertId]
    );
    return mapAccountEntry(rows[0]);
  }

  // "Saldar cuenta": borra TODAS las boletas abiertas del cliente de una
  // sola vez (version simple, sin pagos parciales).
  async settleAccount(clientId: number): Promise<void> {
    await this.databaseService.execute(`DELETE FROM saas_piloto_account_entries WHERE client_id = ?`, [clientId]);
  }
}
