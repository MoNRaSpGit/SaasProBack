import { Injectable, NotFoundException } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CreateRopaClientDto } from "./dto/create-ropa-client.dto";
import { UpdateRopaClientDto } from "./dto/update-ropa-client.dto";
import { RopaClient } from "./ropa.types";

type RopaClientRow = RowDataPacket & {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  due_date: string;
  created_at: string;
};

// due_date y created_at se traen con DATE_FORMAT (nunca la columna
// cruda) para que mysql2 los devuelva como string tal cual, sin que el
// driver los reinterprete con la timezone del proceso de Node -- mismo
// criterio que el resto del modulo ropa.
const CLIENT_COLUMNS = `
  id, name, email, phone,
  DATE_FORMAT(due_date, '%Y-%m-%d') AS due_date,
  DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%S') AS created_at
`;

@Injectable()
export class RopaClientsService {
  constructor(private readonly databaseService: DatabaseService) {}

  // Cuenta corriente -- SOLO el admin ve esta lista (a diferencia de
  // productos/carrusel, que son publicos): tiene email/telefono de
  // clientes reales.
  async listClients(): Promise<{ items: RopaClient[] }> {
    const rows = await this.databaseService.query<RopaClientRow[]>(
      `SELECT ${CLIENT_COLUMNS} FROM saas_ropa_clients ORDER BY due_date ASC`
    );
    return { items: rows.map((row) => this.mapClient(row)) };
  }

  async createClient(dto: CreateRopaClientDto): Promise<{ item: RopaClient }> {
    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_ropa_clients (name, email, phone, due_date) VALUES (?, ?, ?, ?)`,
      [dto.name.trim(), dto.email?.trim() || null, dto.phone?.trim() || null, dto.dueDate]
    );
    return this.getClientOrThrow(result.insertId);
  }

  async updateClient(clientId: number, dto: UpdateRopaClientDto): Promise<{ item: RopaClient }> {
    const existingRows = await this.databaseService.query<RopaClientRow[]>(
      `SELECT ${CLIENT_COLUMNS} FROM saas_ropa_clients WHERE id = ? LIMIT 1`,
      [clientId]
    );
    const existing = existingRows[0];
    if (!existing) {
      throw new NotFoundException("Cliente no encontrado");
    }

    await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_ropa_clients SET name = ?, email = ?, phone = ?, due_date = ? WHERE id = ?`,
      [
        dto.name?.trim() ?? existing.name,
        dto.email !== undefined ? dto.email.trim() || null : existing.email,
        dto.phone !== undefined ? dto.phone.trim() || null : existing.phone,
        dto.dueDate ?? existing.due_date,
        clientId
      ]
    );

    return this.getClientOrThrow(clientId);
  }

  async deleteClient(clientId: number): Promise<{ ok: true }> {
    const result = await this.databaseService.execute<ResultSetHeader>(`DELETE FROM saas_ropa_clients WHERE id = ?`, [
      clientId
    ]);
    if (result.affectedRows === 0) {
      throw new NotFoundException("Cliente no encontrado");
    }
    return { ok: true };
  }

  // Publico (no private): mismo motivo que getProductOrThrow -- el
  // controller necesita el "antes" para la auditoria.
  async getClientOrThrow(clientId: number): Promise<{ item: RopaClient }> {
    const rows = await this.databaseService.query<RopaClientRow[]>(
      `SELECT ${CLIENT_COLUMNS} FROM saas_ropa_clients WHERE id = ? LIMIT 1`,
      [clientId]
    );
    const row = rows[0];
    if (!row) {
      throw new NotFoundException("Cliente no encontrado");
    }
    return { item: this.mapClient(row) };
  }

  private mapClient(row: RopaClientRow): RopaClient {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      dueDate: row.due_date,
      createdAt: row.created_at
    };
  }
}
