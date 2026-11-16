import { Injectable, Logger } from "@nestjs/common";
import { DatabaseService } from "../../shared/database/database.service";
import { RopaUser } from "./ropa.types";

export type RopaAuditAction =
  | "create"
  | "update"
  | "delete"
  | "reorder"
  | "upload_image"
  | "register"
  | "login"
  | "login_failed"
  | "checkout_whatsapp"
  // Visitantes (30/10/2026): contador de visitas y recorrido, ver TrackRopaEventDto.
  | "visit"
  | "view_product"
  | "add_to_cart"
  | "open_cart"
  | "whatsapp_click";

export type RopaAuditEntityType = "product" | "product_image" | "carousel_image" | "client" | "user" | "cart" | "discount_config" | "visitor";

export type RopaAuditEvent = {
  action: RopaAuditAction;
  entityType: RopaAuditEntityType;
  entityId?: string | number | null;
  entityLabel?: string | null;
  actor?: Pick<RopaUser, "email" | "role"> | { email: string; role?: string } | null;
  details?: Record<string, unknown> | null;
};

// Diferencias campo por campo entre dos versiones de una entidad: solo los
// campos que de verdad cambiaron, como { campo: [antes, despues] }. Devuelve
// null si no cambio nada (asi un "guardar sin tocar nada" no ensucia el
// registro).
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: T,
  fields: ReadonlyArray<keyof T & string>
): Record<string, [unknown, unknown]> | null {
  const changes: Record<string, [unknown, unknown]> = {};
  for (const field of fields) {
    // JSON para comparar tambien listas (talles) por contenido, no por referencia.
    if (JSON.stringify(before[field]) !== JSON.stringify(after[field])) {
      changes[field] = [before[field] ?? null, after[field] ?? null];
    }
  }
  return Object.keys(changes).length ? changes : null;
}

// Registro de auditoria de ropa (19/09/2026, pedido explicito: "tener
// auditoria para ver que paso: si se edito algo, se subio un producto
// nuevo, etc"). Es PARA NOSOTROS -- no hay pantalla, se consulta con
// scripts/inspect-ropa-audit.js.
//
// Regla clave: registrar NUNCA puede romper la operacion real. Si la tabla
// no responde, se loguea el error y se sigue -- que un producto no se
// guarde porque fallo la auditoria seria peor que perder una linea de
// registro.
@Injectable()
export class RopaAuditService {
  private readonly logger = new Logger(RopaAuditService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async record(event: RopaAuditEvent): Promise<void> {
    try {
      // UTC explicito armado en Node (no CURRENT_TIMESTAMP del servidor de
      // MySQL): mismo criterio que oriol.dateUtils.ts.
      const occurredAt = new Date().toISOString().slice(0, 19).replace("T", " ");

      await this.databaseService.execute(
        `INSERT INTO saas_ropa_audit_log
           (occurred_at, action, entity_type, entity_id, entity_label, actor_email, actor_role, details)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          occurredAt,
          event.action,
          event.entityType,
          event.entityId != null ? String(event.entityId) : null,
          event.entityLabel ? event.entityLabel.slice(0, 255) : null,
          event.actor?.email ?? null,
          event.actor?.role ?? null,
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
