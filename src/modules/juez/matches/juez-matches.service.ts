import { Injectable, NotFoundException } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../../shared/database/database.service";
import { CreateJuezMatchDto } from "./dto/create-juez-match.dto";
import { ToggleJuezAvailabilityDto } from "./dto/toggle-juez-availability.dto";
import { ConfirmJuezAssignmentDto } from "./dto/confirm-juez-assignment.dto";
import { JuezAssignment, JuezAvailabilityEntry, JuezMatch, JuezMatchStatus } from "./juez-matches.types";

type JuezMatchRow = RowDataPacket & {
  id: number;
  tournament: string;
  home_side: string;
  away_side: string;
  venue: string;
  match_date: string | Date;
  match_time: string;
  status: JuezMatchStatus;
};

type JuezAvailabilityRow = RowDataPacket & {
  match_id: number;
  referee_id: string;
  created_at: string | Date;
};

type JuezAssignmentRow = RowDataPacket & {
  match_id: number;
  principal_referee_id: string;
  secondary_referee_id: string;
  scorer_referee_id: string;
  confirmed_at: string | Date;
};

@Injectable()
export class JuezMatchesService {
  private ensureTablesPromise: Promise<void> | null = null;

  constructor(private readonly databaseService: DatabaseService) {}

  async listMatches() {
    await this.ensureTables();

    const rows = await this.databaseService.query<JuezMatchRow[]>(
      `SELECT id, tournament, home_side, away_side, venue, match_date, match_time, status
       FROM saas_juez_matches
       ORDER BY match_date DESC, match_time DESC`
    );

    return { items: rows.map((row) => this.mapMatch(row)) };
  }

  async createMatch(dto: CreateJuezMatchDto) {
    await this.ensureTables();

    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_juez_matches (tournament, home_side, away_side, venue, match_date, match_time, status)
       VALUES (?, ?, ?, ?, ?, ?, 'open')`,
      [dto.tournament.trim(), dto.homeSide.trim(), dto.awaySide.trim(), dto.venue.trim(), dto.date, dto.time]
    );

    const rows = await this.databaseService.query<JuezMatchRow[]>(
      `SELECT id, tournament, home_side, away_side, venue, match_date, match_time, status
       FROM saas_juez_matches
       WHERE id = ?
       LIMIT 1`,
      [result.insertId]
    );

    return { item: this.mapMatch(rows[0]) };
  }

  async listAvailability() {
    await this.ensureTables();

    const rows = await this.databaseService.query<JuezAvailabilityRow[]>(
      `SELECT match_id, referee_id, created_at FROM saas_juez_availability`
    );

    return { items: rows.map((row) => this.mapAvailability(row)) };
  }

  async toggleAvailability(matchId: number, dto: ToggleJuezAvailabilityDto) {
    await this.ensureTables();

    const existing = await this.databaseService.query<RowDataPacket[]>(
      `SELECT id FROM saas_juez_availability WHERE match_id = ? AND referee_id = ? LIMIT 1`,
      [matchId, dto.refereeId]
    );

    if (existing.length) {
      await this.databaseService.execute(`DELETE FROM saas_juez_availability WHERE match_id = ? AND referee_id = ?`, [
        matchId,
        dto.refereeId
      ]);
    } else {
      await this.databaseService.execute(`INSERT INTO saas_juez_availability (match_id, referee_id) VALUES (?, ?)`, [
        matchId,
        dto.refereeId
      ]);
    }

    return this.listAvailability();
  }

  async listAssignments() {
    await this.ensureTables();

    const rows = await this.databaseService.query<JuezAssignmentRow[]>(
      `SELECT match_id, principal_referee_id, secondary_referee_id, scorer_referee_id, confirmed_at FROM saas_juez_assignments`
    );

    return { items: rows.map((row) => this.mapAssignment(row)) };
  }

  async confirmAssignment(matchId: number, dto: ConfirmJuezAssignmentDto) {
    await this.ensureTables();

    const match = await this.databaseService.query<RowDataPacket[]>(`SELECT id FROM saas_juez_matches WHERE id = ? LIMIT 1`, [
      matchId
    ]);
    if (!match.length) {
      throw new NotFoundException("El partido no existe.");
    }

    await this.databaseService.execute(`DELETE FROM saas_juez_assignments WHERE match_id = ?`, [matchId]);
    await this.databaseService.execute(
      `INSERT INTO saas_juez_assignments (match_id, principal_referee_id, secondary_referee_id, scorer_referee_id, confirmed_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [matchId, dto.principalRefereeId, dto.secondaryRefereeId, dto.scorerRefereeId]
    );
    await this.databaseService.execute(`UPDATE saas_juez_matches SET status = 'assigned' WHERE id = ?`, [matchId]);

    return this.listAssignments();
  }

  async resetAssignment(matchId: number) {
    await this.ensureTables();

    const match = await this.databaseService.query<RowDataPacket[]>(`SELECT id FROM saas_juez_matches WHERE id = ? LIMIT 1`, [
      matchId
    ]);
    if (!match.length) {
      throw new NotFoundException("El partido no existe.");
    }

    await this.databaseService.execute(`DELETE FROM saas_juez_assignments WHERE match_id = ?`, [matchId]);
    await this.databaseService.execute(`UPDATE saas_juez_matches SET status = 'open' WHERE id = ?`, [matchId]);

    return this.listAssignments();
  }

  private mapMatch(row: JuezMatchRow): JuezMatch {
    return {
      id: String(row.id),
      tournament: row.tournament,
      homeSide: row.home_side,
      awaySide: row.away_side,
      venue: row.venue,
      date: this.toDateOnly(row.match_date),
      time: row.match_time,
      status: row.status
    };
  }

  private mapAvailability(row: JuezAvailabilityRow): JuezAvailabilityEntry {
    return {
      matchId: String(row.match_id),
      refereeId: row.referee_id,
      createdAt: this.toIsoString(row.created_at)
    };
  }

  private mapAssignment(row: JuezAssignmentRow): JuezAssignment {
    return {
      matchId: String(row.match_id),
      principalRefereeId: row.principal_referee_id,
      secondaryRefereeId: row.secondary_referee_id,
      scorerRefereeId: row.scorer_referee_id,
      confirmedAt: this.toIsoString(row.confirmed_at)
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
      `CREATE TABLE IF NOT EXISTS saas_juez_matches (
         id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
         tournament VARCHAR(150) NOT NULL,
         home_side VARCHAR(120) NOT NULL,
         away_side VARCHAR(120) NOT NULL,
         venue VARCHAR(150) NOT NULL,
         match_date DATE NOT NULL,
         match_time VARCHAR(5) NOT NULL,
         status ENUM('open', 'closed', 'assigned') NOT NULL DEFAULT 'open',
         created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
         updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
         PRIMARY KEY (id),
         KEY idx_saas_juez_matches_date (match_date)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    await this.databaseService.execute(
      `CREATE TABLE IF NOT EXISTS saas_juez_availability (
         id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
         match_id BIGINT UNSIGNED NOT NULL,
         referee_id VARCHAR(64) NOT NULL,
         created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
         PRIMARY KEY (id),
         UNIQUE KEY uniq_saas_juez_availability_match_referee (match_id, referee_id),
         KEY idx_saas_juez_availability_match (match_id)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    await this.databaseService.execute(
      `CREATE TABLE IF NOT EXISTS saas_juez_assignments (
         id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
         match_id BIGINT UNSIGNED NOT NULL,
         principal_referee_id VARCHAR(64) NOT NULL,
         secondary_referee_id VARCHAR(64) NOT NULL,
         scorer_referee_id VARCHAR(64) NOT NULL,
         confirmed_at DATETIME NOT NULL,
         created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
         updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
         PRIMARY KEY (id),
         UNIQUE KEY uniq_saas_juez_assignments_match (match_id)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
  }
}
