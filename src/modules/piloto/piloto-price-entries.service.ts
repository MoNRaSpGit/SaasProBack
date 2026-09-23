import { Injectable, NotFoundException } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CreatePilotoPriceEntryDto } from "./dto/create-piloto-price-entry.dto";
import { UpdatePilotoPriceEntryDto } from "./dto/update-piloto-price-entry.dto";
import { PilotoPriceCategory, PilotoPriceEntry } from "./piloto.types";

type PilotoPriceEntryRow = RowDataPacket & {
  id: number;
  category: PilotoPriceCategory;
  name: string;
  price: string | number;
  created_at: string | Date;
  updated_at: string | Date;
};

const COLUMNS = "id, category, name, price, created_at, updated_at";

// "Precios" -- Modo Pro (23/09/2026, pedido explicito): lista chica de
// precios por categoria (Congelados, Frutas y verduras, Empanadas,
// Otros), sin buscador ni categorias adicionales por ahora. Mismo patron
// simple que joker-payment-accounts.service.ts.
@Injectable()
export class PilotoPriceEntriesService {
  constructor(private readonly databaseService: DatabaseService) {}

  // Se trae la lista completa en un solo pedido (pocas categorias, pocos
  // precios) -- el filtro por categoria se hace en el frontend al elegir
  // la subpestana, sin ida y vuelta al servidor por cada cambio.
  async listPriceEntries(): Promise<{ items: PilotoPriceEntry[] }> {
    const rows = await this.databaseService.query<PilotoPriceEntryRow[]>(
      `SELECT ${COLUMNS} FROM saas_piloto_price_entries ORDER BY category ASC, name ASC`
    );

    return { items: rows.map((row) => this.mapPriceEntry(row)) };
  }

  async createPriceEntry(dto: CreatePilotoPriceEntryDto): Promise<{ item: PilotoPriceEntry }> {
    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_piloto_price_entries (category, name, price) VALUES (?, ?, ?)`,
      [dto.category, dto.name.trim(), dto.price]
    );

    return this.getPriceEntryById(result.insertId);
  }

  async updatePriceEntry(id: number, dto: UpdatePilotoPriceEntryDto): Promise<{ item: PilotoPriceEntry }> {
    const result = await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_piloto_price_entries SET name = ?, price = ? WHERE id = ?`,
      [dto.name.trim(), dto.price, id]
    );

    if (!result.affectedRows) {
      throw new NotFoundException("Precio no encontrado");
    }

    return this.getPriceEntryById(id);
  }

  async deletePriceEntry(id: number): Promise<{ ok: true }> {
    const result = await this.databaseService.execute<ResultSetHeader>(
      `DELETE FROM saas_piloto_price_entries WHERE id = ?`,
      [id]
    );

    if (!result.affectedRows) {
      throw new NotFoundException("Precio no encontrado");
    }

    return { ok: true };
  }

  private async getPriceEntryById(id: number): Promise<{ item: PilotoPriceEntry }> {
    const rows = await this.databaseService.query<PilotoPriceEntryRow[]>(
      `SELECT ${COLUMNS} FROM saas_piloto_price_entries WHERE id = ? LIMIT 1`,
      [id]
    );

    if (!rows[0]) {
      throw new NotFoundException("Precio no encontrado");
    }

    return { item: this.mapPriceEntry(rows[0]) };
  }

  private mapPriceEntry(row: PilotoPriceEntryRow): PilotoPriceEntry {
    return {
      id: Number(row.id),
      category: row.category,
      name: row.name,
      price: Number(row.price),
      createdAt: this.toIsoString(row.created_at),
      updatedAt: this.toIsoString(row.updated_at)
    };
  }

  private toIsoString(value: string | Date) {
    return value instanceof Date ? value.toISOString() : value;
  }
}
