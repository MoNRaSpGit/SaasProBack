import { Injectable, OnModuleInit, UnauthorizedException } from "@nestjs/common";
import { compare, hash } from "bcryptjs";
import { randomBytes } from "node:crypto";
import { RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { LoginGpsUserDto } from "./dto/login-gps-user.dto";

export type GpsRole = "admin" | "repartidor";

export type GpsUser = {
  id: number;
  username: string;
  fullName: string | null;
  role: GpsRole;
};

type GpsUserRow = RowDataPacket & {
  id: number;
  username: string;
  password_hash: string;
  full_name: string | null;
  role: GpsRole;
};

type GpsSessionRow = RowDataPacket & {
  user_id: number;
  expires_at: string | Date;
};

// Mismo esquema que gym-auth.service.ts / qq-auth.service.ts: sesiones por
// token opaco (no JWT). Usuarios fijos creados en el seed inicial (ver
// ensureDefaultUsers), no hay registro publico.
const SESSION_TTL_DAYS = 30;

// Migracion (20/10/2026, pedido explicito): ya no hay una cuenta por
// persona (Martín/Ana/Pedro) -- ahora es un solo rol "repartidor" generico,
// con 5 contraseñas validas (para que varios celulares puedan entrar sin
// compartir el mismo string). Quien sea Martín/Ana/Juan/Pedro ahora es
// solo una pestaña dentro de la app, ver PERSONAS en gps-data.service.ts
// -- no tiene nada que ver con el login.
const REPARTIDOR_PASSWORD_SEEDS = ["repartidor1", "repartidor2", "repartidor3", "repartidor4", "repartidor5"];

@Injectable()
export class GpsAuthService implements OnModuleInit {
  private ensureTablesPromise: Promise<void> | null = null;

  constructor(private readonly databaseService: DatabaseService) {}

  async onModuleInit() {
    await this.ensureTables();
    await this.ensureDefaultUsers();
    await this.ensureRepartidorRoster();
  }

  async login(dto: LoginGpsUserDto): Promise<{ user: GpsUser; token: string }> {
    await this.ensureTables();

    const rows = await this.databaseService.query<GpsUserRow[]>(
      `SELECT id, username, password_hash, full_name, role FROM saas_gps_users WHERE username = ? LIMIT 1`,
      [dto.username.trim().toLowerCase()]
    );
    const row = rows[0];
    if (!row || !(await compare(dto.password, row.password_hash))) {
      throw new UnauthorizedException("Usuario o contraseña incorrectos");
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
    await this.databaseService.execute(`INSERT INTO saas_gps_sessions (user_id, token, expires_at) VALUES (?, ?, ?)`, [
      row.id,
      token,
      expiresAt
    ]);
    return { user: this.mapUser(row), token };
  }

  // Login generico de repartidor: no hay identidad personal, cualquiera
  // de las 5 contraseñas (un celular distinto cada una) entra al mismo
  // rol "repartidor" -- adentro elige la pestaña (Martín/Ana/Juan/Pedro).
  // El admin sigue entrando por login() con usuario + contraseña.
  async loginByPassword(password: string): Promise<{ user: GpsUser; token: string }> {
    await this.ensureTables();

    const rows = await this.databaseService.query<GpsUserRow[]>(
      `SELECT id, username, password_hash, full_name, role FROM saas_gps_users WHERE role = 'repartidor'`
    );

    for (const row of rows) {
      if (await compare(password, row.password_hash)) {
        const token = randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
        await this.databaseService.execute(`INSERT INTO saas_gps_sessions (user_id, token, expires_at) VALUES (?, ?, ?)`, [
          row.id,
          token,
          expiresAt
        ]);
        return { user: this.mapUser(row), token };
      }
    }

    throw new UnauthorizedException("Contraseña incorrecta.");
  }

  async logout(token: string): Promise<void> {
    await this.databaseService.execute(`DELETE FROM saas_gps_sessions WHERE token = ?`, [token]);
  }

  async requireUser(authorization: string | undefined): Promise<GpsUser> {
    const token = extractBearerToken(authorization);
    const user = token ? await this.getUserForToken(token) : null;
    if (!user) {
      throw new UnauthorizedException("Sesión inválida o vencida. Volvé a iniciar sesión.");
    }
    return user;
  }

  async requireRole(authorization: string | undefined, ...roles: GpsRole[]): Promise<GpsUser> {
    const user = await this.requireUser(authorization);
    if (!roles.includes(user.role)) {
      throw new UnauthorizedException("No tenés permiso para esta acción.");
    }
    return user;
  }

  private async getUserForToken(token: string): Promise<GpsUser | null> {
    const sessionRows = await this.databaseService.query<GpsSessionRow[]>(
      `SELECT user_id, expires_at FROM saas_gps_sessions WHERE token = ? LIMIT 1`,
      [token]
    );
    const session = sessionRows[0];
    if (!session) return null;
    if (new Date(session.expires_at).getTime() < Date.now()) {
      await this.logout(token);
      return null;
    }

    const userRows = await this.databaseService.query<GpsUserRow[]>(
      `SELECT id, username, password_hash, full_name, role FROM saas_gps_users WHERE id = ? LIMIT 1`,
      [session.user_id]
    );
    return userRows[0] ? this.mapUser(userRows[0]) : null;
  }

  private mapUser(row: GpsUserRow): GpsUser {
    return { id: row.id, username: row.username, fullName: row.full_name, role: row.role };
  }

  private async ensureTables() {
    if (!this.ensureTablesPromise) {
      this.ensureTablesPromise = this.createTables().catch((error) => {
        this.ensureTablesPromise = null;
        throw error;
      });
    }
    await this.ensureTablesPromise;
  }

  private async createTables() {
    await this.databaseService.execute(
      `CREATE TABLE IF NOT EXISTS saas_gps_users (
         id INT AUTO_INCREMENT PRIMARY KEY,
         username VARCHAR(60) NOT NULL UNIQUE,
         password_hash VARCHAR(255) NOT NULL,
         full_name VARCHAR(120) NULL,
         role ENUM('admin', 'vendedor', 'repartidor') NOT NULL,
         created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
    await this.databaseService.execute(
      `CREATE TABLE IF NOT EXISTS saas_gps_sessions (
         token VARCHAR(64) NOT NULL PRIMARY KEY,
         user_id INT NOT NULL,
         expires_at TIMESTAMP NOT NULL,
         created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
         CONSTRAINT fk_gps_sessions_user FOREIGN KEY (user_id) REFERENCES saas_gps_users (id) ON DELETE CASCADE
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
  }

  private async ensureDefaultUsers() {
    const rows = await this.databaseService.query<RowDataPacket[]>(`SELECT COUNT(*) as count FROM saas_gps_users`);
    if (Number(rows[0]?.count ?? 0) > 0) {
      return;
    }

    const adminHash = await hash("admin", 10);
    await this.databaseService.execute(`INSERT INTO saas_gps_users (username, password_hash, full_name, role) VALUES (?, ?, ?, 'admin')`, [
      "admin",
      adminHash,
      "Administrador"
    ]);
  }

  // Migracion (20/10/2026): se saca el roster de cuentas personales
  // (martin/ana/pedro) y se reemplaza por 5 cuentas genericas
  // "repartidor1".."repartidor5", todas rol repartidor. Corre siempre:
  // borra las cuentas viejas por nombre y sincroniza las 5 nuevas (para
  // que si se corre de nuevo no truene si ya existian).
  private async ensureRepartidorRoster() {
    await this.databaseService.execute(`DELETE FROM saas_gps_users WHERE username IN ('vendedor', 'repartidor', 'martin', 'ana', 'pedro')`);

    const existingRows = await this.databaseService.query<RowDataPacket[]>(`SELECT username FROM saas_gps_users WHERE role = 'repartidor'`);
    const existingUsernames = new Set(existingRows.map((row) => row.username));

    for (const password of REPARTIDOR_PASSWORD_SEEDS) {
      const username = password; // "repartidor1".."repartidor5": solo identifica el dispositivo, no una persona.
      const passwordHash = await hash(password, 10);
      if (existingUsernames.has(username)) {
        await this.databaseService.execute(`UPDATE saas_gps_users SET password_hash = ? WHERE username = ?`, [passwordHash, username]);
      } else {
        await this.databaseService.execute(
          `INSERT INTO saas_gps_users (username, password_hash, full_name, role) VALUES (?, ?, NULL, 'repartidor')`,
          [username, passwordHash]
        );
      }
    }
  }
}

export function extractBearerToken(authorization: string | undefined): string | undefined {
  if (!authorization?.startsWith("Bearer ")) return undefined;
  return authorization.slice("Bearer ".length).trim() || undefined;
}
