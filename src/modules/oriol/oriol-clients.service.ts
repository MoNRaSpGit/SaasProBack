import { Injectable, NotFoundException } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CreateOriolClientDto } from "./dto/create-oriol-client.dto";
import { toIsoString } from "./oriol.dateUtils";
import { OriolSalesService } from "./oriol-sales.service";
import { OriolClient, OriolSale } from "./oriol.types";

type OriolClientRow = RowDataPacket & {
  id: number;
  nombre: string;
  telefono: string | null;
  cedula: string | null;
  deuda: string | number;
  deuda_dolares: string | number;
  created_at: string | Date;
};

@Injectable()
export class OriolClientsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly salesService: OriolSalesService
  ) {}

  async listClients(): Promise<{ items: OriolClient[] }> {
    const rows = await this.databaseService.query<OriolClientRow[]>(`SELECT * FROM saas_oriol_clientes ORDER BY nombre`);
    return { items: rows.map((row) => this.mapClient(row)) };
  }

  async getClient(clientId: number): Promise<{ item: OriolClient }> {
    const rows = await this.databaseService.query<OriolClientRow[]>(`SELECT * FROM saas_oriol_clientes WHERE id = ? LIMIT 1`, [
      clientId
    ]);
    if (!rows[0]) {
      throw new NotFoundException("Cliente no encontrado");
    }
    return { item: this.mapClient(rows[0]) };
  }

  async createClient(dto: CreateOriolClientDto): Promise<{ item: OriolClient }> {
    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_oriol_clientes (nombre, telefono, cedula) VALUES (?, ?, ?)`,
      [dto.nombre.trim(), dto.telefono ?? null, dto.cedula ?? null]
    );
    return this.getClient(result.insertId);
  }

  async getClientHistory(clientId: number): Promise<{ items: OriolSale[] }> {
    const items = await this.salesService.getSalesByClientId(clientId);
    return { items };
  }

  private mapClient(row: OriolClientRow): OriolClient {
    return {
      id: row.id,
      nombre: row.nombre,
      telefono: row.telefono,
      cedula: row.cedula,
      deuda: Number(row.deuda),
      deudaDolares: Number(row.deuda_dolares),
      createdAt: toIsoString(row.created_at)
    };
  }
}
