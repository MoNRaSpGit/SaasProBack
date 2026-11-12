import { BadRequestException, Injectable } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { TrackEmeActivityDto } from "./dto/track-eme-activity.dto";

// Demo de "Eme" (pedidos para restaurantes): UNA sola sesion compartida por
// todos los dispositivos. El backend solo guarda el estado completo de la
// demo (JSON) con un numero de version; la logica vive en el frontend. Si
// dos dispositivos escriben a la vez, gana el primero y el otro recibe el
// estado nuevo para reintentar (control optimista por version).
const MAX_STATE_BYTES = 1_000_000;

type StateRow = RowDataPacket & { version: number; state: string | null };

export type EmeStateResponse = { ok: boolean; version: number; unchanged?: boolean; state: unknown | null };

@Injectable()
export class EmeService {
  private tableReady: Promise<void> | null = null;

  constructor(private readonly databaseService: DatabaseService) {}

  private ensureTable(): Promise<void> {
    if (!this.tableReady) {
      this.tableReady = (async () => {
        await this.databaseService.execute(
          `CREATE TABLE IF NOT EXISTS saas_eme_demo_state (
            id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
            version INT UNSIGNED NOT NULL DEFAULT 0,
            state LONGTEXT NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
        );
        await this.databaseService.execute(`INSERT IGNORE INTO saas_eme_demo_state (id, version, state) VALUES (1, 0, NULL)`);
      })().catch((error) => {
        this.tableReady = null;
        throw error;
      });
    }
    return this.tableReady;
  }

  private async readRow(): Promise<StateRow> {
    const rows = await this.databaseService.query<StateRow[]>(`SELECT version, state FROM saas_eme_demo_state WHERE id = 1`);
    return rows[0];
  }

  // Registro interno de uso (para Movimientos): quien entro y que hizo.
  async trackActivity(dto: TrackEmeActivityDto, userAgent?: string): Promise<void> {
    await this.databaseService.execute(
      `INSERT INTO saas_eme_activity_log (visitor_id, event, detail, user_agent, occurred_at)
       VALUES (?, ?, ?, ?, UTC_TIMESTAMP())`,
      [dto.visitorId, dto.event, dto.detail?.trim() || null, userAgent?.slice(0, 255) || null]
    );
  }

  async getState(since: number | null): Promise<EmeStateResponse> {
    await this.ensureTable();
    const row = await this.readRow();
    if (since !== null && since === row.version) return { ok: true, version: row.version, unchanged: true, state: null };
    return { ok: true, version: row.version, state: row.state ? JSON.parse(row.state) : null };
  }

  async putState(baseVersion: number, state: unknown): Promise<EmeStateResponse> {
    await this.ensureTable();
    if (!state || typeof state !== "object") throw new BadRequestException("Estado invalido.");
    const json = JSON.stringify(state);
    if (Buffer.byteLength(json) > MAX_STATE_BYTES) throw new BadRequestException("El estado es demasiado grande.");

    const result = await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_eme_demo_state SET version = version + 1, state = ? WHERE id = 1 AND version = ?`,
      [json, baseVersion]
    );
    const row = await this.readRow();
    if (result.affectedRows === 0) {
      // Otro dispositivo escribio antes: devolvemos lo ultimo para que reintente.
      return { ok: false, version: row.version, state: row.state ? JSON.parse(row.state) : null };
    }
    return { ok: true, version: row.version, state: null };
  }
}
