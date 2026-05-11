import { Injectable } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { SaveAgroDiscoveryResponseDto } from "./dto/save-agro-discovery-response.dto";
import { SaveAgroWorkspaceDto } from "./dto/save-agro-workspace.dto";
import {
  AGRO_DISCOVERY_MODULE_KEY,
  AGRO_DISCOVERY_VERSION,
  AGRO_WORKSPACE_PUBLIC_KEY,
  AGRO_WORKSPACE_VERSION,
  AgroDiscoveryResponseRecord,
  AgroWorkspaceData,
  AgroWorkspaceRecord,
  AgroRequestUser
} from "./agro.types";

type AgroDiscoveryRow = RowDataPacket & {
  id: number;
  tenant_id: number;
  module_key: string;
  version: string;
  answered_at: string | Date;
  answers_json: string | Buffer | AgroDiscoveryResponseRecord["answers"];
  created_at: string | Date;
  updated_at: string | Date;
};

type AgroWorkspaceRow = RowDataPacket & {
  id: number;
  workspace_key: string;
  version: string;
  workspace_json: string | Buffer | AgroWorkspaceData;
  updated_at: string | Date;
};

@Injectable()
export class AgroService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getPublicWorkspace() {
    await this.ensurePublicWorkspaceTable();

    const rows = await this.databaseService.query<AgroWorkspaceRow[]>(
      `SELECT
         id,
         workspace_key,
         version,
         workspace_json,
         updated_at
       FROM saas_agro_public_workspaces
       WHERE workspace_key = ?
       LIMIT 1`,
      [AGRO_WORKSPACE_PUBLIC_KEY]
    );

    return rows[0] ? this.mapWorkspaceRow(rows[0]) : this.getEmptyWorkspace();
  }

  async savePublicWorkspace(dto: SaveAgroWorkspaceDto) {
    await this.ensurePublicWorkspaceTable();

    await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_agro_public_workspaces (
         workspace_key,
         version,
         workspace_json
       ) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         version = VALUES(version),
         workspace_json = VALUES(workspace_json),
         updated_at = CURRENT_TIMESTAMP`,
      [
        AGRO_WORKSPACE_PUBLIC_KEY,
        AGRO_WORKSPACE_VERSION,
        JSON.stringify({
          animalMovements: dto.animalMovements,
          accountingEntries: dto.accountingEntries,
          rainfallRecords: dto.rainfallRecords,
          sanitaryRecords: dto.sanitaryRecords,
          monthlyExchangeRates: dto.monthlyExchangeRates
        } satisfies AgroWorkspaceData)
      ]
    );

    return this.getPublicWorkspace();
  }

  getStatus(currentUser: AgroRequestUser) {
    return {
      module: "agro",
      status: "ok",
      tenantId: currentUser.tenantId,
      tenantName: currentUser.tenantName,
      persistenceScope: {
        backendReadyNow: ["discovery"],
        localDemoOnly: ["stock-demo", "accounting-demo", "reports-demo"]
      }
    };
  }

  async saveDiscoveryResponse(currentUser: AgroRequestUser, dto: SaveAgroDiscoveryResponseDto) {
    const normalizedAnswers = dto.answers.map((answer) => ({
      questionId: answer.questionId.trim(),
      selectedOption: answer.selectedOption.trim()
    }));

    const insertResult = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_agro_discovery_responses (
         tenant_id,
         module_key,
         version,
         answered_at,
         answers_json
       ) VALUES (?, ?, ?, ?, ?)`,
      [
        currentUser.tenantId,
        AGRO_DISCOVERY_MODULE_KEY,
        AGRO_DISCOVERY_VERSION,
        this.toMysqlDateTime(dto.answeredAt),
        JSON.stringify(normalizedAnswers)
      ]
    );

    return this.getDiscoveryResponseById(insertResult.insertId);
  }

  async getLatestDiscoveryResponse(currentUser: AgroRequestUser) {
    const rows = await this.databaseService.query<AgroDiscoveryRow[]>(
      `SELECT
         id,
         tenant_id,
         module_key,
         version,
         answered_at,
         answers_json,
         created_at,
         updated_at
       FROM saas_agro_discovery_responses
       WHERE tenant_id = ?
       ORDER BY answered_at DESC, id DESC
       LIMIT 1`,
      [currentUser.tenantId]
    );

    return rows[0] ? this.mapDiscoveryRow(rows[0]) : null;
  }

  private async getDiscoveryResponseById(discoveryResponseId: number) {
    const rows = await this.databaseService.query<AgroDiscoveryRow[]>(
      `SELECT
         id,
         tenant_id,
         module_key,
         version,
         answered_at,
         answers_json,
         created_at,
         updated_at
       FROM saas_agro_discovery_responses
       WHERE id = ?
       LIMIT 1`,
      [discoveryResponseId]
    );

    return this.mapDiscoveryRow(rows[0]);
  }

  private mapDiscoveryRow(row: AgroDiscoveryRow): AgroDiscoveryResponseRecord {
    const parsedAnswers = this.parseAnswersJson(row.answers_json);

    return {
      id: row.id,
      tenantId: row.tenant_id,
      moduleKey: AGRO_DISCOVERY_MODULE_KEY,
      version: AGRO_DISCOVERY_VERSION,
      answeredAt: this.toIsoString(row.answered_at),
      answers: parsedAnswers,
      createdAt: this.toIsoString(row.created_at),
      updatedAt: this.toIsoString(row.updated_at)
    };
  }

  private mapWorkspaceRow(row: AgroWorkspaceRow): AgroWorkspaceRecord {
    return {
      workspaceKey: AGRO_WORKSPACE_PUBLIC_KEY,
      version: AGRO_WORKSPACE_VERSION,
      data: this.parseWorkspaceJson(row.workspace_json),
      updatedAt: this.toIsoString(row.updated_at)
    };
  }

  private parseWorkspaceJson(value: AgroWorkspaceRow["workspace_json"]): AgroWorkspaceData {
    const parsedValue = Array.isArray(value)
      ? value
      : JSON.parse(Buffer.isBuffer(value) ? value.toString("utf8") : String(value));

    const workspace = parsedValue as Partial<AgroWorkspaceData>;

    return {
      animalMovements: Array.isArray(workspace.animalMovements) ? workspace.animalMovements : [],
      accountingEntries: Array.isArray(workspace.accountingEntries) ? workspace.accountingEntries : [],
      rainfallRecords: Array.isArray(workspace.rainfallRecords) ? workspace.rainfallRecords : [],
      sanitaryRecords: Array.isArray(workspace.sanitaryRecords) ? workspace.sanitaryRecords : [],
      monthlyExchangeRates: Array.isArray(workspace.monthlyExchangeRates) ? workspace.monthlyExchangeRates : []
    };
  }

  private getEmptyWorkspace(): AgroWorkspaceRecord {
    return {
      workspaceKey: AGRO_WORKSPACE_PUBLIC_KEY,
      version: AGRO_WORKSPACE_VERSION,
      data: {
        animalMovements: [],
        accountingEntries: [],
        rainfallRecords: [],
        sanitaryRecords: [],
        monthlyExchangeRates: []
      },
      updatedAt: null
    };
  }

  private async ensurePublicWorkspaceTable() {
    await this.databaseService.execute(
      `CREATE TABLE IF NOT EXISTS saas_agro_public_workspaces (
         id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
         workspace_key VARCHAR(40) NOT NULL,
         version VARCHAR(20) NOT NULL DEFAULT 'v1',
         workspace_json JSON NOT NULL,
         created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
         updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
         PRIMARY KEY (id),
         UNIQUE KEY uq_saas_agro_public_workspace_key (workspace_key)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
  }

  private parseAnswersJson(value: AgroDiscoveryRow["answers_json"]) {
    if (Array.isArray(value)) {
      return value;
    }

    const normalizedString = Buffer.isBuffer(value) ? value.toString("utf8") : String(value);
    return JSON.parse(normalizedString) as AgroDiscoveryResponseRecord["answers"];
  }

  private toIsoString(value: string | Date) {
    if (value instanceof Date) {
      return value.toISOString();
    }

    return value;
  }

  private toMysqlDateTime(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    const hours = String(date.getUTCHours()).padStart(2, "0");
    const minutes = String(date.getUTCMinutes()).padStart(2, "0");
    const seconds = String(date.getUTCSeconds()).padStart(2, "0");

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }
}
