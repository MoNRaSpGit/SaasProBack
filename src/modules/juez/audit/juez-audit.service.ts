import { Injectable } from "@nestjs/common";
import { RowDataPacket } from "mysql2";
import { DatabaseService } from "../../../shared/database/database.service";

type JuezAuditRow = RowDataPacket & {
  id: number;
  action: string;
  actor: string;
  details: string;
  created_at: string | Date;
};

// Auditoria de Juez (10/10/2026, pedido explicito): "quiero saber si se
// loguean, actualizan algo, agregan jugadores etc" -- igual que
// agro/gym/piloto, sin pantalla propia en la app (es solo para nosotros).
// Se consulta con backend/scripts/inspect-juez-audit.js.
@Injectable()
export class JuezAuditService {
  private ensureTablesPromise: Promise<void> | null = null;

  constructor(private readonly databaseService: DatabaseService) {}

  async record(action: string, actor: string, details: string) {
    await this.ensureTables();

    await this.databaseService.execute(
      `INSERT INTO saas_juez_audit_log (action, actor, details) VALUES (?, ?, ?)`,
      [action, actor || "desconocido", details]
    );
  }

  async listRecent(limit = 200) {
    await this.ensureTables();

    const rows = await this.databaseService.query<JuezAuditRow[]>(
      `SELECT id, action, actor, details, created_at
       FROM saas_juez_audit_log
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
      [limit]
    );

    return rows;
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
      `CREATE TABLE IF NOT EXISTS saas_juez_audit_log (
         id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
         action VARCHAR(40) NOT NULL,
         actor VARCHAR(40) NOT NULL,
         details TEXT NOT NULL,
         created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
         PRIMARY KEY (id),
         KEY idx_saas_juez_audit_log_created_at (created_at)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
  }
}
