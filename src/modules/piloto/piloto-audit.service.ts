import { Injectable, Logger } from "@nestjs/common";
import { DatabaseService } from "../../shared/database/database.service";

export type PilotoAuditAction = "create" | "update" | "sale";

export type PilotoAuditEntityType = "product" | "sale";

export type PilotoAuditEvent = {
  action: PilotoAuditAction;
  entityType: PilotoAuditEntityType;
  entityId?: string | number | null;
  entityLabel?: string | null;
  details?: Record<string, unknown> | null;
};

// Diferencias campo por campo entre dos versiones de una entidad: solo los
// campos que de verdad cambiaron, como { campo: [antes, despues] }. Devuelve
// null si no cambio nada (asi un "guardar sin tocar nada" no ensucia el
// registro). Mismo helper que ya usa qq-audit.service.ts.
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: T,
  fields: ReadonlyArray<keyof T & string>
): Record<string, [unknown, unknown]> | null {
  const changes: Record<string, [unknown, unknown]> = {};
  for (const field of fields) {
    if (before[field] !== after[field]) {
      changes[field] = [before[field] ?? null, after[field] ?? null];
    }
  }
  return Object.keys(changes).length ? changes : null;
}

// Registro de auditoria de piloto (22/09/2026, pedido explicito: "hacerle
// auditoria al igual que tenemos en los otros proyectos, para saber bien y
// con exactitud los movimientos"). Es PARA NOSOTROS -- no hay pantalla, se
// consulta con scripts/inspect-piloto-audit.js. Piloto no tiene login, asi
// que a diferencia de qq nunca hay "actor" -- queda implicito (un solo
// operador con el POS).
//
// Regla clave (igual que qq): registrar NUNCA puede romper la operacion
// real. Si la tabla no responde, se loguea el error y se sigue -- que una
// venta no se guarde porque fallo la auditoria seria muchisimo peor que
// perder una linea de registro.
@Injectable()
export class PilotoAuditService {
  private readonly logger = new Logger(PilotoAuditService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async record(event: PilotoAuditEvent): Promise<void> {
    try {
      // UTC explicito armado en Node (no CURRENT_TIMESTAMP del servidor de
      // MySQL): mismo criterio que qq-audit.service.ts / oriol.dateUtils.ts.
      const occurredAt = new Date().toISOString().slice(0, 19).replace("T", " ");

      await this.databaseService.execute(
        `INSERT INTO saas_piloto_audit_log
           (occurred_at, action, entity_type, entity_id, entity_label, details)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          occurredAt,
          event.action,
          event.entityType,
          event.entityId != null ? String(event.entityId) : null,
          event.entityLabel ? event.entityLabel.slice(0, 255) : null,
          event.details ? JSON.stringify(event.details) : null
        ]
      );
    } catch (error) {
      this.logger.error(
        `No se pudo registrar la auditoria (${event.action} ${event.entityType}): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
