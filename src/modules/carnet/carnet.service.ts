import { BadRequestException, Injectable } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CreateCarnetPlayerDto } from "./dto/create-carnet-player.dto";
import { UpdateCarnetPlayerDto } from "./dto/update-carnet-player.dto";
import { CarnetPlayer, CarnetStatus } from "./carnet.types";

type CarnetPlayerRow = RowDataPacket & {
  id: number;
  name: string;
  expiry_date: string | Date;
  created_at: string | Date;
  updated_at: string | Date;
};

@Injectable()
export class CarnetService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getStatus(): Promise<CarnetStatus> {
    await this.ensureTable();
    const count = await this.countPlayers();

    return {
      module: "carnet",
      status: "ok",
      playersCount: count,
      backend: {
        database: "connected",
        currentTimestamp: new Date().toISOString()
      }
    };
  }

  async listPlayers() {
    await this.ensureTable();

    const rows = await this.databaseService.query<CarnetPlayerRow[]>(
      `SELECT
         id,
         name,
         expiry_date,
         created_at,
         updated_at
       FROM saas_carnet_players
       ORDER BY expiry_date ASC, name ASC`
    );

    return {
      items: rows.map((row) => this.mapPlayer(row)),
      meta: {
        count: rows.length
      }
    };
  }

  async createPlayer(dto: CreateCarnetPlayerDto) {
    await this.ensureTable();

    const name = dto.name.trim();
    const expiryDate = this.normalizeDate(dto.expiryDate);

    const duplicateRows = await this.databaseService.query<CarnetPlayerRow[]>(
      `SELECT
         id,
         name,
         expiry_date,
         created_at,
         updated_at
       FROM saas_carnet_players
       WHERE LOWER(name) = LOWER(?)
         AND expiry_date = ?
       LIMIT 1`,
      [name, expiryDate]
    );

    if (duplicateRows[0]) {
      return { item: this.mapPlayer(duplicateRows[0]) };
    }

    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_carnet_players (
         name,
         expiry_date
       ) VALUES (?, ?)`,
      [name, expiryDate]
    );

    const rows = await this.databaseService.query<CarnetPlayerRow[]>(
      `SELECT
         id,
         name,
         expiry_date,
         created_at,
         updated_at
       FROM saas_carnet_players
       WHERE id = ?
       LIMIT 1`,
      [result.insertId]
    );

    return { item: this.mapPlayer(rows[0]) };
  }

  async updatePlayer(playerId: number, dto: UpdateCarnetPlayerDto) {
    await this.ensureTable();

    const currentRows = await this.databaseService.query<CarnetPlayerRow[]>(
      `SELECT
         id,
         name,
         expiry_date,
         created_at,
         updated_at
       FROM saas_carnet_players
       WHERE id = ?
       LIMIT 1`,
      [playerId]
    );

    if (!currentRows[0]) {
      throw new BadRequestException("Jugador no encontrado");
    }

    const currentPlayer = currentRows[0];
    const nextName = dto.name?.trim() || currentPlayer.name;
    const nextExpiryDate = dto.expiryDate ? this.normalizeDate(dto.expiryDate) : this.toIsoDate(currentPlayer.expiry_date);

    const duplicateRows = await this.databaseService.query<CarnetPlayerRow[]>(
      `SELECT
         id,
         name,
         expiry_date,
         created_at,
         updated_at
       FROM saas_carnet_players
       WHERE LOWER(name) = LOWER(?)
         AND expiry_date = ?
         AND id <> ?
       LIMIT 1`,
      [nextName, nextExpiryDate, playerId]
    );

    if (duplicateRows[0]) {
      return { item: this.mapPlayer(duplicateRows[0]) };
    }

    await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_carnet_players
       SET name = ?,
           expiry_date = ?
       WHERE id = ?`,
      [nextName, nextExpiryDate, playerId]
    );

    const rows = await this.databaseService.query<CarnetPlayerRow[]>(
      `SELECT
         id,
         name,
         expiry_date,
         created_at,
         updated_at
       FROM saas_carnet_players
       WHERE id = ?
       LIMIT 1`,
      [playerId]
    );

    return { item: this.mapPlayer(rows[0]) };
  }

  async deletePlayer(playerId: number) {
    await this.ensureTable();

    const currentRows = await this.databaseService.query<CarnetPlayerRow[]>(
      `SELECT
         id,
         name,
         expiry_date,
         created_at,
         updated_at
       FROM saas_carnet_players
       WHERE id = ?
       LIMIT 1`,
      [playerId]
    );

    if (!currentRows[0]) {
      throw new BadRequestException("Jugador no encontrado");
    }

    const player = this.mapPlayer(currentRows[0]);

    await this.databaseService.execute<ResultSetHeader>(
      `DELETE FROM saas_carnet_players
       WHERE id = ?`,
      [playerId]
    );

    return { item: player };
  }

  private mapPlayer(row: CarnetPlayerRow | undefined): CarnetPlayer {
    if (!row) {
      throw new BadRequestException("Jugador no encontrado");
    }

    return {
      id: row.id,
      name: row.name,
      expiryDate: this.toIsoDate(row.expiry_date),
      createdAt: this.toIsoString(row.created_at),
      updatedAt: this.toIsoString(row.updated_at)
    };
  }

  private async ensureTable() {
    await this.databaseService.execute(
      `CREATE TABLE IF NOT EXISTS saas_carnet_players (
         id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
         name VARCHAR(120) NOT NULL,
         expiry_date DATE NOT NULL,
         created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
         updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
         PRIMARY KEY (id),
         KEY idx_saas_carnet_players_expiry_date (expiry_date),
         KEY idx_saas_carnet_players_name (name)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
  }

  private async countPlayers() {
    const rows = await this.databaseService.query<Array<RowDataPacket & { total: number }>>(
      `SELECT COUNT(*) AS total
       FROM saas_carnet_players`
    );

    return Number(rows[0]?.total || 0);
  }

  private normalizeDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException("Fecha de vencimiento invalida");
    }

    return this.toMysqlDate(date);
  }

  private toMysqlDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private toIsoDate(value: string | Date) {
    if (value instanceof Date) {
      return this.toMysqlDate(value);
    }

    return value;
  }

  private toIsoString(value: string | Date) {
    if (value instanceof Date) {
      return value.toISOString();
    }

    return value;
  }
}
