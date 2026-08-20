import { ConflictException, Injectable } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../../shared/database/database.service";
import { CreateJuezTeamDto } from "./dto/create-juez-team.dto";
import { JuezTeam } from "./juez-teams.types";

type JuezTeamRow = RowDataPacket & {
  id: number;
  name: string;
  division: "A" | "B";
  sex: "masculino" | "femenino";
  created_at: string | Date;
  updated_at: string | Date;
};

const TEAM_COLUMNS = `
  id,
  name,
  division,
  sex,
  created_at,
  updated_at
`;

@Injectable()
export class JuezTeamsService {
  private ensureTablesPromise: Promise<void> | null = null;

  constructor(private readonly databaseService: DatabaseService) {}

  async listTeams() {
    await this.ensureTables();

    const rows = await this.databaseService.query<JuezTeamRow[]>(
      `SELECT ${TEAM_COLUMNS}
       FROM saas_juez_teams
       ORDER BY name ASC, division ASC, sex ASC`
    );

    return { items: rows.map((row) => this.mapTeam(row)) };
  }

  async createTeam(dto: CreateJuezTeamDto) {
    await this.ensureTables();

    const name = dto.name.trim();

    const existing = await this.databaseService.query<JuezTeamRow[]>(
      `SELECT ${TEAM_COLUMNS}
       FROM saas_juez_teams
       WHERE name = ? AND division = ? AND sex = ?
       LIMIT 1`,
      [name, dto.division, dto.sex]
    );

    if (existing.length) {
      throw new ConflictException("Ya existe un equipo con ese nombre, division y sexo.");
    }

    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_juez_teams (name, division, sex) VALUES (?, ?, ?)`,
      [name, dto.division, dto.sex]
    );

    const rows = await this.databaseService.query<JuezTeamRow[]>(
      `SELECT ${TEAM_COLUMNS}
       FROM saas_juez_teams
       WHERE id = ?
       LIMIT 1`,
      [result.insertId]
    );

    return { item: this.mapTeam(rows[0]) };
  }

  private mapTeam(row: JuezTeamRow): JuezTeam {
    return {
      id: Number(row.id),
      name: row.name,
      division: row.division,
      sex: row.sex,
      createdAt: this.toIsoString(row.created_at),
      updatedAt: this.toIsoString(row.updated_at)
    };
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
      `CREATE TABLE IF NOT EXISTS saas_juez_teams (
         id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
         name VARCHAR(120) NOT NULL,
         division ENUM('A', 'B') NOT NULL,
         sex ENUM('masculino', 'femenino') NOT NULL,
         created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
         updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
         PRIMARY KEY (id),
         UNIQUE KEY uniq_saas_juez_teams_name_division_sex (name, division, sex)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
  }
}
