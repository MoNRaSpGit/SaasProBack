import { Injectable } from "@nestjs/common";
import { ResultSetHeader } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { TrackTamboActivityDto } from "./dto/track-tambo-activity.dto";

@Injectable()
export class TamboService {
  constructor(private readonly databaseService: DatabaseService) {}

  // Registro interno de uso (29/10/2026): no hay pantalla en la app que lo
  // muestre (se consulta con scripts/inspect-tambo-activity.js). Sirve para
  // saber si el cliente la prueba, separado de nuestras propias entradas.
  async trackActivity(dto: TrackTamboActivityDto, userAgent?: string): Promise<void> {
    await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_tambo_activity_log (visitor_id, role, event, detail, user_agent, occurred_at)
       VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
      [dto.visitorId, dto.role, dto.event, dto.detail?.trim() || null, userAgent?.slice(0, 255) || null]
    );
  }
}
