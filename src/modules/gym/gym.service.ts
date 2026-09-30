import { ConflictException, Injectable } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { SaveGymWorkspaceDto } from "./dto/save-gym-workspace.dto";
import { emptyGymWorkspaceData, GymAuditAction, GymWorkspaceData, GymWorkspaceRecord } from "./gym.types";

const GYM_WORKSPACE_KEY = "public";

type GymWorkspaceRow = RowDataPacket & {
  id: number;
  workspace_key: string;
  workspace_json: string | Buffer | GymWorkspaceData;
  row_version: number;
  updated_at: string | Date;
};

// Sin tenant/login real todavia (pedido explicito, 30/09/2026: "por ahora
// que estamos en fase de pruebas que ese login entre directo") -- un
// unico workspace global, igual de espiritu que el workspace de Agro pero
// sin el aislamiento por tenant_id. Cuando se agregue login de verdad,
// esto pasa a filtrar por tenant igual que agro.service.ts.
@Injectable()
export class GymService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getWorkspace(): Promise<GymWorkspaceRecord> {
    const rows = await this.databaseService.query<GymWorkspaceRow[]>(
      `SELECT id, workspace_key, workspace_json, row_version, updated_at
       FROM saas_gym_workspaces
       WHERE workspace_key = ?
       LIMIT 1`,
      [GYM_WORKSPACE_KEY]
    );

    if (!rows[0]) {
      return { data: emptyGymWorkspaceData(), rowVersion: 0, updatedAt: null };
    }

    return this.mapWorkspaceRow(rows[0]);
  }

  async saveWorkspace(dto: SaveGymWorkspaceDto): Promise<GymWorkspaceRecord> {
    const currentRows = await this.databaseService.query<GymWorkspaceRow[]>(
      `SELECT id, workspace_key, workspace_json, row_version, updated_at
       FROM saas_gym_workspaces
       WHERE workspace_key = ?
       LIMIT 1`,
      [GYM_WORKSPACE_KEY]
    );

    if (
      currentRows[0] &&
      dto.expectedRowVersion !== null &&
      dto.expectedRowVersion !== undefined &&
      currentRows[0].row_version !== dto.expectedRowVersion
    ) {
      throw new ConflictException(
        "Alguien mas (otra pestana o dispositivo) ya guardo un cambio mas nuevo. Recarga la pagina antes de seguir."
      );
    }

    const nextData: GymWorkspaceData = {
      expenses: dto.expenses as GymWorkspaceData["expenses"],
      tasks: dto.tasks as GymWorkspaceData["tasks"],
      movements: dto.movements as GymWorkspaceData["movements"],
      auditLog: dto.auditLog as GymWorkspaceData["auditLog"]
    };

    await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_gym_workspaces (workspace_key, workspace_json, row_version)
       VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE
         workspace_json = VALUES(workspace_json),
         row_version = row_version + 1,
         updated_at = CURRENT_TIMESTAMP`,
      [GYM_WORKSPACE_KEY, JSON.stringify(nextData)]
    );

    return this.getWorkspace();
  }

  // Login "pasa directo" (sin usuario/contrasena todavia): igual queda un
  // rastro en la auditoria de cuando se toco "Ingresar", para no perder
  // el habito de auditar desde el dia 1.
  async recordLogin(): Promise<GymWorkspaceRecord> {
    const current = await this.getWorkspace();
    return this.saveWorkspace({
      expectedRowVersion: current.rowVersion || null,
      expenses: current.data.expenses,
      tasks: current.data.tasks,
      movements: current.data.movements,
      auditLog: [this.buildAuditEntry("login", "Se abrio la app"), ...current.data.auditLog]
    });
  }

  private buildAuditEntry(action: GymAuditAction, details: string) {
    return {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      action,
      timestamp: new Date().toISOString(),
      details
    };
  }

  private mapWorkspaceRow(row: GymWorkspaceRow): GymWorkspaceRecord {
    const data = typeof row.workspace_json === "string" ? JSON.parse(row.workspace_json) : row.workspace_json;
    return {
      data: data as GymWorkspaceData,
      rowVersion: row.row_version,
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at
    };
  }
}
