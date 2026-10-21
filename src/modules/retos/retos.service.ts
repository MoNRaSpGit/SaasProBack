import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CreateRetoChallengeDto } from "./dto/create-reto-challenge.dto";
import { ResolveRetoChallengeDto } from "./dto/resolve-reto-challenge.dto";
import { RANKS, RetoChallenge, RetoCompletion, RetoState, RetoType } from "./retos.types";

type ChallengeRow = RowDataPacket & { id: number; title: string; type: RetoType; active: number; created_at: string };
type CompletionRow = RowDataPacket & {
  id: number;
  challenge_id: number;
  title: string;
  type: RetoType;
  period_label: string | null;
  result: "cumplido" | "fallado";
  rank_after: number;
  resolved_at: string;
};
type StateRow = RowDataPacket & { rank_index: number };

function todayLabel(): string {
  const montevideoNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Montevideo" }));
  return `${montevideoNow.getFullYear()}-${String(montevideoNow.getMonth() + 1).padStart(2, "0")}-${String(
    montevideoNow.getDate()
  ).padStart(2, "0")}`;
}

// Semana ISO (lunes a domingo) en hora Montevideo, como "YYYY-Www".
function thisWeekLabel(): string {
  const montevideoNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Montevideo" }));
  const date = new Date(Date.UTC(montevideoNow.getFullYear(), montevideoNow.getMonth(), montevideoNow.getDate()));
  const dayNumber = (date.getUTCDay() + 6) % 7; // lunes = 0
  date.setUTCDate(date.getUTCDate() - dayNumber + 3); // jueves de esa semana
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((date.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function currentPeriodLabel(type: RetoType): string | null {
  if (type === "diario") return todayLabel();
  if (type === "semanal") return thisWeekLabel();
  return null;
}

@Injectable()
export class RetosService implements OnModuleInit {
  private ensureTablesPromise: Promise<void> | null = null;

  constructor(private readonly databaseService: DatabaseService) {}

  async onModuleInit() {
    await this.ensureTables();
  }

  async listChallenges(): Promise<RetoChallenge[]> {
    await this.ensureTables();
    const rows = await this.databaseService.query<ChallengeRow[]>(
      `SELECT id, title, type, active, DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s') AS created_at
       FROM saas_retos_challenges WHERE active = 1 ORDER BY created_at ASC`
    );

    const challenges: RetoChallenge[] = [];
    for (const row of rows) {
      const periodLabel = currentPeriodLabel(row.type);
      let resolved = false;
      if (periodLabel !== null) {
        const existing = await this.databaseService.query<RowDataPacket[]>(
          `SELECT 1 FROM saas_retos_completions WHERE challenge_id = ? AND period_label = ? LIMIT 1`,
          [row.id, periodLabel]
        );
        resolved = existing.length > 0;
      }
      challenges.push({
        id: row.id,
        title: row.title,
        type: row.type,
        active: Boolean(row.active),
        createdAt: `${row.created_at}Z`,
        resolvedForCurrentPeriod: resolved
      });
    }
    return challenges;
  }

  async createChallenge(dto: CreateRetoChallengeDto): Promise<RetoChallenge> {
    await this.ensureTables();
    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_retos_challenges (title, type) VALUES (?, ?)`,
      [dto.title.trim(), dto.type]
    );
    const rows = await this.databaseService.query<ChallengeRow[]>(
      `SELECT id, title, type, active, DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s') AS created_at
       FROM saas_retos_challenges WHERE id = ?`,
      [result.insertId]
    );
    const row = rows[0];
    return { id: row.id, title: row.title, type: row.type, active: Boolean(row.active), createdAt: `${row.created_at}Z`, resolvedForCurrentPeriod: false };
  }

  async deleteChallenge(challengeId: number): Promise<void> {
    await this.ensureTables();
    await this.databaseService.execute(`DELETE FROM saas_retos_challenges WHERE id = ?`, [challengeId]);
  }

  // Cumplido sube un escalon, fallado baja uno -- nunca sale de los
  // limites de RANKS. Los retos diarios/semanales solo se pueden
  // resolver una vez por periodo; los unicos se desactivan al resolverse.
  async resolveChallenge(challengeId: number, dto: ResolveRetoChallengeDto): Promise<RetoState> {
    await this.ensureTables();
    const rows = await this.databaseService.query<ChallengeRow[]>(`SELECT id, title, type, active FROM saas_retos_challenges WHERE id = ?`, [
      challengeId
    ]);
    const challenge = rows[0];
    if (!challenge || !challenge.active) throw new NotFoundException("No existe ese reto (o ya no está activo).");

    const periodLabel = currentPeriodLabel(challenge.type);
    if (periodLabel !== null) {
      const existing = await this.databaseService.query<RowDataPacket[]>(
        `SELECT 1 FROM saas_retos_completions WHERE challenge_id = ? AND period_label = ? LIMIT 1`,
        [challengeId, periodLabel]
      );
      if (existing.length > 0) {
        throw new BadRequestException("Ese reto ya se resolvió en este período.");
      }
    }

    const stateRows = await this.databaseService.query<StateRow[]>(`SELECT rank_index FROM saas_retos_state WHERE id = 1`);
    const currentRankIndex = stateRows[0]?.rank_index ?? 0;
    const delta = dto.result === "cumplido" ? 1 : -1;
    const nextRankIndex = Math.max(0, Math.min(RANKS.length - 1, currentRankIndex + delta));

    await this.databaseService.execute(
      `INSERT INTO saas_retos_completions (challenge_id, period_label, result, rank_after) VALUES (?, ?, ?, ?)`,
      [challengeId, periodLabel, dto.result, nextRankIndex]
    );
    await this.databaseService.execute(`UPDATE saas_retos_state SET rank_index = ? WHERE id = 1`, [nextRankIndex]);

    if (challenge.type === "unico") {
      await this.databaseService.execute(`UPDATE saas_retos_challenges SET active = 0 WHERE id = ?`, [challengeId]);
    }

    return this.getState();
  }

  async getState(): Promise<RetoState> {
    await this.ensureTables();
    const stateRows = await this.databaseService.query<StateRow[]>(`SELECT rank_index FROM saas_retos_state WHERE id = 1`);
    const rankIndex = stateRows[0]?.rank_index ?? 0;

    const countRows = await this.databaseService.query<Array<RowDataPacket & { result: "cumplido" | "fallado"; total: number }>>(
      `SELECT result, COUNT(*) AS total FROM saas_retos_completions GROUP BY result`
    );
    let totalCumplidos = 0;
    let totalFallados = 0;
    for (const row of countRows) {
      if (row.result === "cumplido") totalCumplidos = Number(row.total);
      else totalFallados = Number(row.total);
    }

    return { rankIndex, rank: RANKS[rankIndex], totalCumplidos, totalFallados };
  }

  async listHistory(limit = 50): Promise<RetoCompletion[]> {
    await this.ensureTables();
    const rows = await this.databaseService.query<CompletionRow[]>(
      `SELECT c.id, c.challenge_id, ch.title, ch.type, c.period_label, c.result, c.rank_after,
              DATE_FORMAT(c.resolved_at, '%Y-%m-%dT%H:%i:%s') AS resolved_at
       FROM saas_retos_completions c
       JOIN saas_retos_challenges ch ON ch.id = c.challenge_id
       ORDER BY c.resolved_at DESC, c.id DESC
       LIMIT ?`,
      [limit]
    );
    return rows.map((row) => ({
      id: row.id,
      challengeId: row.challenge_id,
      challengeTitle: row.title,
      challengeType: row.type,
      periodLabel: row.period_label,
      result: row.result,
      rankAfter: row.rank_after,
      resolvedAt: `${row.resolved_at}Z`
    }));
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
      `CREATE TABLE IF NOT EXISTS saas_retos_challenges (
         id INT AUTO_INCREMENT PRIMARY KEY,
         title VARCHAR(160) NOT NULL,
         type ENUM('unico', 'diario', 'semanal') NOT NULL,
         active TINYINT(1) NOT NULL DEFAULT 1,
         created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
    await this.databaseService.execute(
      `CREATE TABLE IF NOT EXISTS saas_retos_completions (
         id INT AUTO_INCREMENT PRIMARY KEY,
         challenge_id INT NOT NULL,
         period_label VARCHAR(10) NULL,
         result ENUM('cumplido', 'fallado') NOT NULL,
         rank_after TINYINT NOT NULL,
         resolved_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
         CONSTRAINT fk_retos_completions_challenge FOREIGN KEY (challenge_id) REFERENCES saas_retos_challenges (id) ON DELETE CASCADE
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
    await this.databaseService.execute(
      `CREATE TABLE IF NOT EXISTS saas_retos_state (
         id TINYINT NOT NULL PRIMARY KEY,
         rank_index TINYINT NOT NULL DEFAULT 0
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
    await this.databaseService.execute(`INSERT IGNORE INTO saas_retos_state (id, rank_index) VALUES (1, 0)`);
  }
}
