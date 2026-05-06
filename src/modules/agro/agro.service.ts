import { Injectable } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { SaveAgroDiscoveryResponseDto } from "./dto/save-agro-discovery-response.dto";
import {
  AGRO_DISCOVERY_MODULE_KEY,
  AGRO_DISCOVERY_VERSION,
  AgroDiscoveryResponseRecord,
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

@Injectable()
export class AgroService {
  constructor(private readonly databaseService: DatabaseService) {}

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
