import { createHash } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DatabaseService } from "../../shared/database/database.service";
import { TrackLogiclabEventDto } from "./dto/track-logiclab-event.dto";

// Contador propio de frontend-logiclab (02/11/2026): reemplaza GoatCounter
// porque el usuario quiere los datos en su propia base, sin cuentas
// externas. Nunca se guarda la IP tal cual -- se guarda un hash con sal
// (LOGICLAB_IP_SALT) solo para aproximar visitantes unicos por dia, sin
// poder reconstruir la IP real. Registrar NUNCA puede romper la visita del
// usuario: si la base no responde, se loguea y se sigue.
const DEFAULT_SALT = "logiclab-visitas-2026";

@Injectable()
export class LogiclabVisitsService {
  private readonly logger = new Logger(LogiclabVisitsService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService
  ) {}

  private hashIp(ip: string): string {
    const salt = this.configService.get<string>("LOGICLAB_IP_SALT") || DEFAULT_SALT;
    return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
  }

  async record(dto: TrackLogiclabEventDto, ip: string): Promise<void> {
    try {
      const occurredAt = new Date().toISOString().slice(0, 19).replace("T", " ");
      await this.databaseService.execute(
        `INSERT INTO saas_logiclab_events
           (occurred_at, event, rubro, section, plan, src, visitor_id, visitor_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [occurredAt, dto.event, dto.rubro ?? null, dto.section ?? null, dto.plan ?? null, dto.src ?? null, dto.visitorId, this.hashIp(ip)]
      );
    } catch (error) {
      this.logger.error(
        `No se pudo registrar el evento de logiclab (${dto.event}): ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
