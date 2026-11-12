import { Injectable, NotFoundException } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CreateGabyAccountEntryDto } from "./dto/create-gaby-account-entry.dto";
import { CreateGabyClientDto } from "./dto/create-gaby-client.dto";
import { UpdateGabyClientDto } from "./dto/update-gaby-client.dto";
import { GabyAccountEntry, GabyClient } from "./gaby.types";

type GabyClientRow = RowDataPacket & {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  created_at: string | Date;
};

type GabyAccountEntryRow = RowDataPacket & {
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

function mapClient(row: GabyClientRow): GabyClient {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    address: row.address,
    createdAt: toIsoString(row.created_at)
  };
}

function mapAccountEntry(row: GabyAccountEntryRow): GabyAccountEntry {
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

// Clientes / cuenta corriente de Gaby (06/10/2026, pedido explicito:
// "venta a credito... armar toda la parte del cliente, similar a la de
// Joker, pero plan basico"). Version simple a proposito (confirmado con
// el usuario): sin pagos parciales ni archivo historico -- cada venta a
// credito queda como una "boleta" (account entry) y "saldar cuenta" las
// borra todas de una. El saldo del cliente es simplemente la suma de sus
// boletas abiertas, nunca un numero guardado aparte.
@Injectable()
export class GabyClientsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listClients(): Promise<GabyClient[]> {
    const rows = await this.databaseService.query<GabyClientRow[]>(
      `SELECT * FROM saas_gaby_clients ORDER BY name ASC`
    );
    return rows.map(mapClient);
  }

  async createClient(dto: CreateGabyClientDto): Promise<GabyClient> {
    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_gaby_clients (name, phone, address) VALUES (?, ?, ?)`,
      [dto.name.trim(), dto.phone?.trim() || null, dto.address?.trim() || null]
    );
    const rows = await this.databaseService.query<GabyClientRow[]>(
      `SELECT * FROM saas_gaby_clients WHERE id = ?`,
      [result.insertId]
    );
    return mapClient(rows[0]);
  }

  async updateClient(clientId: number, dto: UpdateGabyClientDto): Promise<GabyClient> {
    const existing = await this.databaseService.query<GabyClientRow[]>(`SELECT * FROM saas_gaby_clients WHERE id = ?`, [clientId]);
    if (!existing[0]) throw new NotFoundException("No existe ese cliente.");
    await this.databaseService.execute(`UPDATE saas_gaby_clients SET name = ?, phone = ?, address = ? WHERE id = ?`, [
      dto.name.trim(),
      dto.phone?.trim() || null,
      dto.address?.trim() || null,
      clientId
    ]);
    const rows = await this.databaseService.query<GabyClientRow[]>(`SELECT * FROM saas_gaby_clients WHERE id = ?`, [clientId]);
    return mapClient(rows[0]);
  }

  async deleteClient(clientId: number): Promise<void> {
    // ON DELETE CASCADE en saas_gaby_account_entries se lleva sus
    // boletas abiertas tambien -- version simple, sin archivo historico.
    await this.databaseService.execute(`DELETE FROM saas_gaby_clients WHERE id = ?`, [clientId]);
  }

  async listAccountEntries(clientId?: number): Promise<GabyAccountEntry[]> {
    const rows = clientId
      ? await this.databaseService.query<GabyAccountEntryRow[]>(
          `SELECT * FROM saas_gaby_account_entries WHERE client_id = ? ORDER BY created_at DESC`,
          [clientId]
        )
      : await this.databaseService.query<GabyAccountEntryRow[]>(
          `SELECT * FROM saas_gaby_account_entries ORDER BY created_at DESC`
        );
    return rows.map(mapAccountEntry);
  }

  async createAccountEntry(dto: CreateGabyAccountEntryDto): Promise<GabyAccountEntry> {
    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_gaby_account_entries (client_id, sale_id, total, items) VALUES (?, ?, ?, ?)`,
      [dto.clientId, dto.saleId ?? null, dto.total, JSON.stringify(dto.items)]
    );
    const rows = await this.databaseService.query<GabyAccountEntryRow[]>(
      `SELECT * FROM saas_gaby_account_entries WHERE id = ?`,
      [result.insertId]
    );
    return mapAccountEntry(rows[0]);
  }

  // "Saldar cuenta": borra TODAS las boletas abiertas del cliente de una
  // sola vez (version simple, sin pagos parciales).
  async settleAccount(clientId: number): Promise<void> {
    await this.databaseService.execute(`DELETE FROM saas_gaby_account_entries WHERE client_id = ?`, [clientId]);
  }
}
