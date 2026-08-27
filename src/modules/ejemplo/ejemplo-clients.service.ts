import { Injectable, NotFoundException } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CreateEjemploClientDto } from "./dto/create-ejemplo-client.dto";
import { EjemploClient } from "./ejemplo.types";

type EjemploClientRow = RowDataPacket & {
  id: number;
  name: string;
  phone: string | null;
  created_at: string | Date;
};

@Injectable()
export class EjemploClientsService {
  private ensureTablesPromise: Promise<void> | null = null;

  constructor(private readonly databaseService: DatabaseService) {}

  async listClients() {
    await this.ensureTables();
    const rows = await this.databaseService.query<EjemploClientRow[]>(
      `SELECT id, name, phone, created_at FROM saas_ejemplo_clients ORDER BY name ASC`
    );
    return { items: rows.map((row) => this.mapClient(row)) };
  }

  async createClient(dto: CreateEjemploClientDto) {
    await this.ensureTables();
    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_ejemplo_clients (name, phone) VALUES (?, ?)`,
      [dto.name.trim(), dto.phone?.trim() ?? ""]
    );
    return { item: await this.getClientOrThrow(result.insertId) };
  }

  async deleteClient(clientId: number) {
    await this.ensureTables();
    await this.getClientOrThrow(clientId);
    await this.databaseService.execute(`DELETE FROM saas_ejemplo_clients WHERE id = ?`, [clientId]);
    return { ok: true };
  }

  async getClientOrThrow(clientId: number) {
    const rows = await this.databaseService.query<EjemploClientRow[]>(
      `SELECT id, name, phone, created_at FROM saas_ejemplo_clients WHERE id = ? LIMIT 1`,
      [clientId]
    );
    if (!rows.length) {
      throw new NotFoundException("El cliente no existe.");
    }
    return this.mapClient(rows[0]);
  }

  private mapClient(row: EjemploClientRow): EjemploClient {
    return {
      id: String(row.id),
      name: row.name,
      phone: row.phone ?? "",
      createdAt: this.toIsoString(row.created_at)
    };
  }

  private toIsoString(value: string | Date) {
    return value instanceof Date ? value.toISOString() : value;
  }

  async ensureTables() {
    if (!this.ensureTablesPromise) {
      this.ensureTablesPromise = this.createTables().catch((error) => {
        this.ensureTablesPromise = null;
        throw error;
      });
    }
    await this.ensureTablesPromise;
  }

  private async createTables() {
    await this.databaseService.execute(
      `CREATE TABLE IF NOT EXISTS saas_ejemplo_clients (
         id INT AUTO_INCREMENT PRIMARY KEY,
         name VARCHAR(160) NOT NULL,
         phone VARCHAR(40) NOT NULL DEFAULT '',
         created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    );
  }
}
