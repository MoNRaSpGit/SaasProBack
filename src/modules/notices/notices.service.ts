import { Injectable, NotFoundException } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";

// Avisos de demora (11/11/2026, pedido explicito): desde Scrum (Clientes) se
// activa un cartel "su servicio se encuentra vencido" para el usuario de
// la app de ese cliente; la app lo muestra al iniciar sesion mientras este
// activo. Un cliente de Scrum se vincula a una app (hoy solo "gym") y a un
// usuario de esa app. Se desactiva a mano desde Scrum cuando paga.
// 16/11/2026: se suman distribuidora, eme, gaby y joker.
// - gym: el aviso va a un GIMNASIO (workspace) y lo ven todos sus usuarios.
// - distribuidora: toda la app, pero solo lo ve el administrador.
// - eme y gaby: no tienen login, le sale a toda la app.
// - joker: toda la app, pero solo lo ve el administrador.
// En las apps "de toda la app" el usuario guardado es el fijo APP_WIDE_USER.
export const NOTICE_APPS = ["gym", "distribuidora", "eme", "gaby", "joker"] as const;
export type NoticeAppKey = (typeof NOTICE_APPS)[number];
export const APP_WIDE_USER = "_app";
const APP_WIDE_APPS: NoticeAppKey[] = ["distribuidora", "eme", "gaby", "joker"];

type NoticeRow = RowDataPacket & {
  scrum_client_id: number;
  app_key: NoticeAppKey;
  app_username: string;
  active: number;
  activated_at: Date | string | null;
  last_seen_at: Date | string | null;
};

export type ClientNotice = {
  clientId: number;
  appKey: NoticeAppKey;
  appUsername: string;
  active: boolean;
  activatedAt: string | null;
  lastSeenAt: string | null;
};

function toIso(value: Date | string | null): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

function mapNotice(row: NoticeRow): ClientNotice {
  return {
    clientId: row.scrum_client_id,
    appKey: row.app_key,
    appUsername: row.app_username,
    active: row.active === 1,
    activatedAt: toIso(row.activated_at),
    lastSeenAt: toIso(row.last_seen_at)
  };
}

@Injectable()
export class NoticesService {
  private tableReady: Promise<void> | null = null;

  constructor(private readonly databaseService: DatabaseService) {}

  // La tabla tambien esta en la migracion 124; esto la crea sola si falta
  // (mismo criterio que ScrumService.ensureTables).
  private ensureTable(): Promise<void> {
    if (!this.tableReady) {
      this.tableReady = this.databaseService
        .execute(
          `CREATE TABLE IF NOT EXISTS saas_service_notices (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            scrum_client_id INT UNSIGNED NOT NULL,
            app_key VARCHAR(30) NOT NULL,
            app_username VARCHAR(80) NOT NULL,
            active TINYINT(1) NOT NULL DEFAULT 0,
            activated_at DATETIME NULL,
            last_seen_at DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_service_notices_client (scrum_client_id),
            KEY idx_service_notices_app_user (app_key, app_username)
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

  async listForScrum(): Promise<ClientNotice[]> {
    await this.ensureTable();
    const rows = await this.databaseService.query<NoticeRow[]>(
      `SELECT scrum_client_id, app_key, app_username, active, activated_at, last_seen_at FROM saas_service_notices`
    );
    return rows.map(mapNotice);
  }

  // Usuarios de cada app a los que se les puede vincular un cliente.
  async listTargets(): Promise<{ appKey: NoticeAppKey; username: string; fullName: string | null }[]> {
    // Gimnasios (workspaces) reales: se muestran con el nombre del primer usuario.
    const gymRows = await this.databaseService.query<(RowDataPacket & { workspace_key: string; full_name: string | null })[]>(
      `SELECT workspace_key, MIN(full_name) AS full_name FROM saas_gym_users GROUP BY workspace_key ORDER BY workspace_key ASC`
    );
    const targets: { appKey: NoticeAppKey; username: string; fullName: string | null }[] = [
      ...gymRows.map((row) => ({ appKey: "gym" as const, username: row.workspace_key, fullName: row.full_name })),
      ...APP_WIDE_APPS.map((appKey) => ({ appKey, username: APP_WIDE_USER, fullName: "Toda la app" }))
    ];
    return targets;
  }

  // Que el destino elegido exista en la app elegida.
  private async userExists(appKey: NoticeAppKey, username: string): Promise<boolean> {
    if (APP_WIDE_APPS.includes(appKey)) return username === APP_WIDE_USER;
    const rows = await this.databaseService.query<RowDataPacket[]>(`SELECT id FROM saas_gym_users WHERE workspace_key = ? LIMIT 1`, [username]);
    return rows.length > 0;
  }

  async setForClient(clientId: number, appKey: NoticeAppKey, appUsername: string, active: boolean): Promise<ClientNotice> {
    await this.ensureTable();
    const clients = await this.databaseService.query<RowDataPacket[]>(`SELECT id FROM saas_scrum_clients WHERE id = ?`, [clientId]);
    if (!clients[0]) throw new NotFoundException("No existe ese cliente.");
    if (!(await this.userExists(appKey, appUsername))) throw new NotFoundException("No existe ese usuario en la app.");

    const existing = await this.databaseService.query<NoticeRow[]>(
      `SELECT scrum_client_id, app_key, app_username, active, activated_at, last_seen_at FROM saas_service_notices WHERE scrum_client_id = ?`,
      [clientId]
    );
    const before = existing[0];
    if (!before) {
      await this.databaseService.execute<ResultSetHeader>(
        `INSERT INTO saas_service_notices (scrum_client_id, app_key, app_username, active, activated_at)
         VALUES (?, ?, ?, ?, ${active ? "NOW()" : "NULL"})`,
        [clientId, appKey, appUsername, active ? 1 : 0]
      );
    } else {
      // Activar de nuevo (o cambiar de usuario) reinicia la fecha y el "visto".
      const restart = active && (before.active !== 1 || before.app_username !== appUsername || before.app_key !== appKey);
      if (restart) {
        await this.databaseService.execute(
          `UPDATE saas_service_notices SET app_key = ?, app_username = ?, active = 1, activated_at = NOW(), last_seen_at = NULL WHERE scrum_client_id = ?`,
          [appKey, appUsername, clientId]
        );
      } else if (active) {
        await this.databaseService.execute(`UPDATE saas_service_notices SET app_key = ?, app_username = ? WHERE scrum_client_id = ?`, [
          appKey,
          appUsername,
          clientId
        ]);
      } else {
        await this.databaseService.execute(
          `UPDATE saas_service_notices SET app_key = ?, app_username = ?, active = 0, activated_at = NULL WHERE scrum_client_id = ?`,
          [appKey, appUsername, clientId]
        );
      }
    }
    const rows = await this.databaseService.query<NoticeRow[]>(
      `SELECT scrum_client_id, app_key, app_username, active, activated_at, last_seen_at FROM saas_service_notices WHERE scrum_client_id = ?`,
      [clientId]
    );
    return mapNotice(rows[0]);
  }

  // Al borrar un cliente de Scrum se borra tambien su aviso.
  async removeForClient(clientId: number): Promise<void> {
    await this.ensureTable();
    await this.databaseService.execute(`DELETE FROM saas_service_notices WHERE scrum_client_id = ?`, [clientId]);
  }

  // Lo pregunta la app al iniciar sesion.
  async isActiveFor(appKey: NoticeAppKey, username: string): Promise<boolean> {
    await this.ensureTable();
    const rows = await this.databaseService.query<RowDataPacket[]>(
      `SELECT id FROM saas_service_notices WHERE app_key = ? AND app_username = ? AND active = 1 LIMIT 1`,
      [appKey, username]
    );
    return rows.length > 0;
  }

  // La app avisa que el cliente vio el cartel (queda visible en Scrum).
  async markSeen(appKey: NoticeAppKey, username: string): Promise<void> {
    await this.ensureTable();
    await this.databaseService.execute(
      `UPDATE saas_service_notices SET last_seen_at = NOW() WHERE app_key = ? AND app_username = ? AND active = 1`,
      [appKey, username]
    );
  }
}
