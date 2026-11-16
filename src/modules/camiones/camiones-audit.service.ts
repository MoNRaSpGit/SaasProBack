import { Injectable, Logger } from "@nestjs/common";
import { RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CamionesRequestUser } from "./camiones.types";

export type CamionesAuditAction = "trip_approved" | "trip_value_changed" | "trip_reassigned" | "trip_edited" | "trip_deleted";

export type TripSnapshot = {
  id: number;
  tripDate: string;
  place: string;
  truck: string | null;
  kilometers: number;
  status: string;
  collectedAmount: number | null;
  notes: string | null;
  userId: number;
  driverName: string | null;
  clientName: string;
};

type SnapshotRow = RowDataPacket & {
  id: number;
  trip_date: Date | string;
  place: string;
  truck: string | null;
  kilometers: string | number;
  status: string;
  collected_amount: string | number | null;
  notes: string | null;
  user_id: number;
  driver_name: string | null;
  client_name: string;
};

// Auditoria de Camiones (16/11/2026, pedido explicito: ver en Movimientos
// quien aprobo, edito o borro cada viaje). Regla clave: registrar NUNCA rompe
// la operacion real -- si la tabla falla, se loguea y se sigue.
@Injectable()
export class CamionesAuditService {
  private readonly logger = new Logger(CamionesAuditService.name);
  private tableReady: Promise<void> | null = null;

  constructor(private readonly databaseService: DatabaseService) {}

  private ensureTable(): Promise<void> {
    if (!this.tableReady) {
      this.tableReady = this.databaseService
        .execute(
          `CREATE TABLE IF NOT EXISTS saas_camiones_audit_log (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, tenant_id INT UNSIGNED NOT NULL, actor_user_id INT UNSIGNED NULL,
            actor_name VARCHAR(160) NULL, action VARCHAR(30) NOT NULL, trip_id INT UNSIGNED NULL, summary VARCHAR(255) NOT NULL,
            details_json TEXT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_camiones_audit_day (tenant_id, created_at), KEY idx_camiones_audit_trip (trip_id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
        )
        .then(() => undefined)
        .catch((error) => {
          this.tableReady = null;
          throw error;
        });
    }
    return this.tableReady;
  }

  // Foto del viaje (con nombre del camionero y del cliente) para comparar antes/despues.
  async snapshot(tenantId: number, tripId: number): Promise<TripSnapshot | null> {
    try {
      const rows = await this.databaseService.query<SnapshotRow[]>(
        `SELECT t.id, t.trip_date, t.place, t.truck, t.kilometers, t.status, t.collected_amount, t.notes, t.user_id,
                COALESCE(u.full_name, u.username) AS driver_name, c.name AS client_name
         FROM saas_camiones_trips t
         INNER JOIN saas_camiones_clients c ON c.id = t.client_id
         LEFT JOIN saas_camiones_users u ON u.id = t.user_id
         WHERE t.id = ? AND t.tenant_id = ? LIMIT 1`,
        [tripId, tenantId]
      );
      const row = rows[0];
      if (!row) return null;
      return {
        id: row.id,
        tripDate: new Date(row.trip_date).toISOString().slice(0, 10),
        place: row.place,
        truck: row.truck,
        kilometers: Number(row.kilometers),
        status: row.status,
        collectedAmount: row.collected_amount === null ? null : Number(row.collected_amount),
        notes: row.notes,
        userId: row.user_id,
        driverName: row.driver_name,
        clientName: row.client_name
      };
    } catch (error) {
      this.logger.error(`No se pudo leer el viaje ${tripId} para auditar`, error instanceof Error ? error.stack : String(error));
      return null;
    }
  }

  async record(
    currentUser: CamionesRequestUser,
    action: CamionesAuditAction,
    trip: Pick<TripSnapshot, "id" | "driverName" | "clientName" | "place" | "notes">,
    summary: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.ensureTable();
      const actors = await this.databaseService.query<(RowDataPacket & { name: string | null })[]>(
        `SELECT COALESCE(full_name, username) AS name FROM saas_camiones_users WHERE id = ? LIMIT 1`,
        [currentUser.userId]
      );
      const from = (trip.notes ?? "").split("||").map((t) => t.trim()).find((t) => t.startsWith("route-from::"))?.slice("route-from::".length).trim();
      const label = `${trip.driverName ?? "?"} · ${trip.clientName} · ${from || "?"} → ${trip.place}`;
      await this.databaseService.execute(
        `INSERT INTO saas_camiones_audit_log (tenant_id, actor_user_id, actor_name, action, trip_id, summary, details_json) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          currentUser.tenantId,
          currentUser.userId,
          actors[0]?.name ?? currentUser.email,
          action,
          trip.id,
          `${summary} · ${label}`.slice(0, 255),
          details ? JSON.stringify(details) : null
        ]
      );
    } catch (error) {
      this.logger.error(`No se pudo registrar la auditoria de camiones (${action})`, error instanceof Error ? error.stack : String(error));
    }
  }
}
