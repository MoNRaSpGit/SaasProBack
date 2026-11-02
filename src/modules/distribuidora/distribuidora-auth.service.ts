import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { compare } from "bcryptjs";
import { randomBytes } from "node:crypto";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { LoginDistribuidoraUserDto } from "./dto/login-distribuidora-user.dto";
import { DistribuidoraRole, DistribuidoraUserSummary } from "./distribuidora.types";

export type DistribuidoraUser = {
  id: number;
  username: string;
  fullName: string | null;
  role: DistribuidoraRole;
};

type UserRow = RowDataPacket & {
  id: number;
  username: string;
  password_hash: string;
  full_name: string | null;
  role: DistribuidoraRole;
};

type UserSummaryRow = RowDataPacket & {
  id: number;
  username: string;
  full_name: string | null;
  role: DistribuidoraRole;
  commission_percent: string;
};

type SessionRow = RowDataPacket & {
  user_id: number;
  expires_at: string | Date;
};

// Mismo esquema que gym-auth.service.ts: sesiones por token opaco (no
// JWT). No hay registro publico -- los usuarios se crean con
// scripts/create-distribuidora-user.js.
// 02/11/2026, pedido explicito: la sesion dura 24 horas (antes 30 dias),
// se cierre o no la app -- si queda abierta todo el dia, a las 24hs
// igual pide login de nuevo.
const SESSION_TTL_HOURS = 24;

@Injectable()
export class DistribuidoraAuthService {
  constructor(private readonly databaseService: DatabaseService) {}

  async login(dto: LoginDistribuidoraUserDto): Promise<{ user: DistribuidoraUser; token: string }> {
    const rows = await this.databaseService.query<UserRow[]>(
      `SELECT id, username, password_hash, full_name, role FROM saas_distribuidora_users WHERE username = ? LIMIT 1`,
      [dto.username.trim().toLowerCase()]
    );
    const row = rows[0];
    const passwordMatches = !!row && (await compare(dto.password, row.password_hash));
    if (!row || !passwordMatches) {
      throw new UnauthorizedException("Usuario o contraseña incorrectos");
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);
    await this.databaseService.execute(`INSERT INTO saas_distribuidora_sessions (user_id, token, expires_at) VALUES (?, ?, ?)`, [
      row.id,
      token,
      expiresAt
    ]);
    return { user: this.mapUser(row), token };
  }

  async logout(token: string): Promise<void> {
    await this.databaseService.execute(`DELETE FROM saas_distribuidora_sessions WHERE token = ?`, [token]);
  }

  async requireUser(authorization: string | undefined): Promise<DistribuidoraUser> {
    const token = extractBearerToken(authorization);
    const user = token ? await this.getUserForToken(token) : null;
    if (!user) {
      throw new UnauthorizedException("Sesión inválida o vencida. Volvé a iniciar sesión.");
    }
    return user;
  }

  requireAdmin(user: DistribuidoraUser): void {
    if (user.role !== "admin") {
      throw new UnauthorizedException("Esa acción es solo para administradores.");
    }
  }

  // Para la pestaña Comisión del admin: cuanto se le paga a cada
  // vendedor segun lo que vendio.
  async listUsers(): Promise<DistribuidoraUserSummary[]> {
    const rows = await this.databaseService.query<UserSummaryRow[]>(
      `SELECT id, username, full_name, role, commission_percent FROM saas_distribuidora_users ORDER BY role DESC, full_name ASC`
    );
    return rows.map((row) => this.mapUserSummary(row));
  }

  async updateCommissionPercent(userId: number, percent: number): Promise<DistribuidoraUserSummary> {
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      throw new BadRequestException("El porcentaje tiene que estar entre 0 y 100.");
    }
    const result = await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_distribuidora_users SET commission_percent = ? WHERE id = ?`,
      [percent, userId]
    );
    if (result.affectedRows === 0) {
      throw new BadRequestException("No existe ese usuario.");
    }
    const rows = await this.databaseService.query<UserSummaryRow[]>(
      `SELECT id, username, full_name, role, commission_percent FROM saas_distribuidora_users WHERE id = ?`,
      [userId]
    );
    return this.mapUserSummary(rows[0]);
  }

  private mapUserSummary(row: UserSummaryRow): DistribuidoraUserSummary {
    return {
      id: row.id,
      username: row.username,
      fullName: row.full_name,
      role: row.role,
      commissionPercent: Number(row.commission_percent)
    };
  }

  private async getUserForToken(token: string): Promise<DistribuidoraUser | null> {
    const sessionRows = await this.databaseService.query<SessionRow[]>(
      `SELECT user_id, expires_at FROM saas_distribuidora_sessions WHERE token = ? LIMIT 1`,
      [token]
    );
    const session = sessionRows[0];
    if (!session) return null;
    if (new Date(session.expires_at).getTime() < Date.now()) {
      await this.logout(token);
      return null;
    }

    const userRows = await this.databaseService.query<UserRow[]>(
      `SELECT id, username, password_hash, full_name, role FROM saas_distribuidora_users WHERE id = ? LIMIT 1`,
      [session.user_id]
    );
    return userRows[0] ? this.mapUser(userRows[0]) : null;
  }

  private mapUser(row: UserRow): DistribuidoraUser {
    return { id: row.id, username: row.username, fullName: row.full_name, role: row.role };
  }
}

export function extractBearerToken(authorization: string | undefined): string | undefined {
  if (!authorization?.startsWith("Bearer ")) return undefined;
  return authorization.slice("Bearer ".length).trim() || undefined;
}
