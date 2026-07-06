import { Injectable } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";

type ScrumSampleRow = RowDataPacket & {
  id: number;
  sprint_name: string;
  task_title: string;
  task_status: string;
  owner_name: string;
  created_at: string | Date;
};

@Injectable()
export class ScrumService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getSample() {
    await this.ensureSampleTable();
    await this.ensureSeedRow();

    const rows = await this.databaseService.query<ScrumSampleRow[]>(
      `SELECT
         id,
         sprint_name,
         task_title,
         task_status,
         owner_name,
         created_at
       FROM saas_scrum_samples
       ORDER BY id ASC
       LIMIT 1`
    );

    const row = rows[0];

    return {
      ok: true,
      item: row
        ? {
            id: Number(row.id),
            sprint: row.sprint_name,
            task: row.task_title,
            status: row.task_status,
            owner: row.owner_name,
            createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at
          }
        : null
    };
  }

  private async ensureSampleTable() {
    await this.databaseService.execute(
      `CREATE TABLE IF NOT EXISTS saas_scrum_samples (
         id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
         sprint_name VARCHAR(120) NOT NULL,
         task_title VARCHAR(180) NOT NULL,
         task_status VARCHAR(80) NOT NULL,
         owner_name VARCHAR(120) NOT NULL,
         created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
         updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
         PRIMARY KEY (id)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
  }

  private async ensureSeedRow() {
    const rows = await this.databaseService.query<Array<RowDataPacket & { total: number }>>(
      `SELECT COUNT(*) AS total
       FROM saas_scrum_samples`
    );

    if (Number(rows[0]?.total || 0) > 0) {
      return;
    }

    await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_scrum_samples (
         sprint_name,
         task_title,
         task_status,
         owner_name
       ) VALUES (?, ?, ?, ?)`,
      ["Sprint 1", "Conexion de prueba con MySQL", "En progreso", "MoNRa"]
    );
  }
}
