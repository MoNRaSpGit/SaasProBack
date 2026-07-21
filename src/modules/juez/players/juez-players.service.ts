import { Injectable } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../../shared/database/database.service";
import { CreateJuezPlayerDto } from "./dto/create-juez-player.dto";
import { JuezPlayer } from "./juez-players.types";

type JuezPlayerRow = RowDataPacket & {
  id: number;
  team: string;
  division: "A" | "B";
  sex: "masculino" | "femenino";
  name: string;
  expiry_date: string | Date;
  cedula: string | null;
  birth_date: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
};

const PLAYER_COLUMNS = `
  id,
  team,
  division,
  sex,
  name,
  expiry_date,
  cedula,
  birth_date,
  created_at,
  updated_at
`;

@Injectable()
export class JuezPlayersService {
  private ensureTablesPromise: Promise<void> | null = null;

  constructor(private readonly databaseService: DatabaseService) {}

  async listPlayers() {
    await this.ensureTables();

    const rows = await this.databaseService.query<JuezPlayerRow[]>(
      `SELECT ${PLAYER_COLUMNS}
       FROM saas_juez_players
       ORDER BY team ASC, division ASC, sex ASC, name ASC`
    );

    return { items: rows.map((row) => this.mapPlayer(row)) };
  }

  async createPlayer(dto: CreateJuezPlayerDto) {
    await this.ensureTables();

    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_juez_players (
         team,
         division,
         sex,
         name,
         expiry_date,
         cedula,
         birth_date
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [dto.team.trim(), dto.division, dto.sex, dto.name.trim(), dto.expiryDate, dto.cedula?.trim() || null, dto.birthDate || null]
    );

    const rows = await this.databaseService.query<JuezPlayerRow[]>(
      `SELECT ${PLAYER_COLUMNS}
       FROM saas_juez_players
       WHERE id = ?
       LIMIT 1`,
      [result.insertId]
    );

    return { item: this.mapPlayer(rows[0]) };
  }

  private mapPlayer(row: JuezPlayerRow): JuezPlayer {
    return {
      id: Number(row.id),
      team: row.team,
      division: row.division,
      sex: row.sex,
      name: row.name,
      expiryDate: this.toDateOnly(row.expiry_date),
      cedula: row.cedula,
      birthDate: row.birth_date ? this.toDateOnly(row.birth_date) : null,
      createdAt: this.toIsoString(row.created_at),
      updatedAt: this.toIsoString(row.updated_at)
    };
  }

  private toDateOnly(value: string | Date) {
    const date = value instanceof Date ? value : new Date(value);
    return date.toISOString().slice(0, 10);
  }

  private toIsoString(value: string | Date) {
    return value instanceof Date ? value.toISOString() : value;
  }

  private async ensureTables() {
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
      `CREATE TABLE IF NOT EXISTS saas_juez_players (
         id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
         team VARCHAR(120) NOT NULL,
         division ENUM('A', 'B') NOT NULL,
         sex ENUM('masculino', 'femenino') NOT NULL,
         name VARCHAR(120) NOT NULL,
         expiry_date DATE NOT NULL,
         cedula VARCHAR(20) NULL,
         birth_date DATE NULL,
         created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
         updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
         PRIMARY KEY (id),
         KEY idx_saas_juez_players_team_division_sex (team, division, sex),
         KEY idx_saas_juez_players_name (name),
         KEY idx_saas_juez_players_expiry_date (expiry_date)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
  }
}
