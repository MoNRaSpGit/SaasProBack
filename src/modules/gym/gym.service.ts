import { ConflictException, Injectable } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { SaveGymWorkspaceDto } from "./dto/save-gym-workspace.dto";
import { emptyGymWorkspaceData, GymAuditAction, GymWorkspaceData, GymWorkspaceRecord } from "./gym.types";

type GymWorkspaceRow = RowDataPacket & {
  id: number;
  workspace_key: string;
  workspace_json: string | Buffer | GymWorkspaceData;
  row_version: number;
  updated_at: string | Date;
};

// Workspace en JSON, mismo espiritu que el de Agro. Cada usuario apunta a
// un workspace_key (saas_gym_users.workspace_key): ale e invitado
// comparten 'public'; un usuario demo puede tener el suyo, vacio.
@Injectable()
export class GymService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getWorkspace(workspaceKey: string): Promise<GymWorkspaceRecord> {
    const rows = await this.databaseService.query<GymWorkspaceRow[]>(
      `SELECT id, workspace_key, workspace_json, row_version, updated_at
       FROM saas_gym_workspaces
       WHERE workspace_key = ?
       LIMIT 1`,
      [workspaceKey]
    );

    if (!rows[0]) {
      return { data: emptyGymWorkspaceData(), rowVersion: 0, updatedAt: null };
    }

    return this.mapWorkspaceRow(rows[0]);
  }

  async saveWorkspace(workspaceKey: string, dto: SaveGymWorkspaceDto): Promise<GymWorkspaceRecord> {
    const currentRows = await this.databaseService.query<GymWorkspaceRow[]>(
      `SELECT id, workspace_key, workspace_json, row_version, updated_at
       FROM saas_gym_workspaces
       WHERE workspace_key = ?
       LIMIT 1`,
      [workspaceKey]
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

    const previousData = currentRows[0] ? this.mapWorkspaceRow(currentRows[0]).data : null;
    const nextData: GymWorkspaceData = {
      expenses: dto.expenses as GymWorkspaceData["expenses"],
      tasks: dto.tasks as GymWorkspaceData["tasks"],
      movements: dto.movements as GymWorkspaceData["movements"],
      // Si un cliente viejo no manda alumnos, se conservan los que ya habia.
      students: (dto.students ?? previousData?.students ?? []) as GymWorkspaceData["students"],
      checkIns: (dto.checkIns ?? previousData?.checkIns ?? []) as GymWorkspaceData["checkIns"],
      auditLog: dto.auditLog as GymWorkspaceData["auditLog"]
    };

    await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_gym_workspaces (workspace_key, workspace_json, row_version)
       VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE
         workspace_json = VALUES(workspace_json),
         row_version = row_version + 1,
         updated_at = CURRENT_TIMESTAMP`,
      [workspaceKey, JSON.stringify(nextData)]
    );

    return this.getWorkspace(workspaceKey);
  }

  // Agrega una entrada a la auditoria del workspace (logins, intentos fallidos).
  async recordAudit(workspaceKey: string, action: GymAuditAction, details: string): Promise<GymWorkspaceRecord> {
    const current = await this.getWorkspace(workspaceKey);
    return this.saveWorkspace(workspaceKey, {
      expectedRowVersion: current.rowVersion || null,
      expenses: current.data.expenses,
      tasks: current.data.tasks,
      movements: current.data.movements,
      students: current.data.students,
      checkIns: current.data.checkIns,
      auditLog: [this.buildAuditEntry(action, details), ...current.data.auditLog]
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
      // Workspaces guardados antes de Alumnos/Ingresar no traen estos campos.
      data: {
        ...(data as GymWorkspaceData),
        students: (data as GymWorkspaceData).students ?? [],
        checkIns: (data as GymWorkspaceData).checkIns ?? []
      },
      rowVersion: row.row_version,
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at
    };
  }
}
