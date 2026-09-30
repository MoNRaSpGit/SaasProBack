import { Injectable, UnauthorizedException } from "@nestjs/common";
import { compare } from "bcryptjs";
import { randomBytes } from "node:crypto";
import { RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { LoginGymUserDto } from "./dto/login-gym-user.dto";

export type GymUser = {
  id: number;
  username: string;
  fullName: string | null;
  workspaceKey: string;
};

type GymUserRow = RowDataPacket & {
  id: number;
  username: string;
  password_hash: string;
  full_name: string | null;
  workspace_key: string;
};

type GymSessionRow = RowDataPacket & {
  user_id: number;
  expires_at: string | Date;
};

// Mismo esquema que qq-auth.service.ts: sesiones por token opaco (no JWT).
// No hay registro publico -- los usuarios se crean con
// scripts/create-gym-user.js.
const SESSION_TTL_DAYS = 30;

@Injectable()
export class GymAuthService {
  constructor(private readonly databaseService: DatabaseService) {}

  async login(dto: LoginGymUserDto): Promise<{ user: GymUser; token: string }> {
    const rows = await this.databaseService.query<GymUserRow[]>(
      `SELECT id, username, password_hash, full_name, workspace_key FROM saas_gym_users WHERE username = ? LIMIT 1`,
      [dto.username.trim().toLowerCase()]
    );
    const row = rows[0];
    if (!row || !(await compare(dto.password, row.password_hash))) {
      throw new UnauthorizedException("Usuario o contraseña incorrectos");
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
    await this.databaseService.execute(`INSERT INTO saas_gym_sessions (user_id, token, expires_at) VALUES (?, ?, ?)`, [
      row.id,
      token,
      expiresAt
    ]);
    return { user: this.mapUser(row), token };
  }

  // Para dejar el intento fallido en la auditoria del workspace correcto.
  async findWorkspaceKeyForUsername(username: string): Promise<string | null> {
    const rows = await this.databaseService.query<GymUserRow[]>(
      `SELECT workspace_key FROM saas_gym_users WHERE username = ? LIMIT 1`,
      [username.trim().toLowerCase()]
    );
    return rows[0]?.workspace_key ?? null;
  }

  async logout(token: string): Promise<void> {
    await this.databaseService.execute(`DELETE FROM saas_gym_sessions WHERE token = ?`, [token]);
  }

  async requireUser(authorization: string | undefined): Promise<GymUser> {
    const token = extractBearerToken(authorization);
    const user = token ? await this.getUserForToken(token) : null;
    if (!user) {
      throw new UnauthorizedException("Sesión inválida o vencida. Volvé a iniciar sesión.");
    }
    return user;
  }

  private async getUserForToken(token: string): Promise<GymUser | null> {
    const sessionRows = await this.databaseService.query<GymSessionRow[]>(
      `SELECT user_id, expires_at FROM saas_gym_sessions WHERE token = ? LIMIT 1`,
      [token]
    );
    const session = sessionRows[0];
    if (!session) return null;
    if (new Date(session.expires_at).getTime() < Date.now()) {
      await this.logout(token);
      return null;
    }

    const userRows = await this.databaseService.query<GymUserRow[]>(
      `SELECT id, username, password_hash, full_name, workspace_key FROM saas_gym_users WHERE id = ? LIMIT 1`,
      [session.user_id]
    );
    return userRows[0] ? this.mapUser(userRows[0]) : null;
  }

  private mapUser(row: GymUserRow): GymUser {
    return { id: row.id, username: row.username, fullName: row.full_name, workspaceKey: row.workspace_key };
  }
}

export function extractBearerToken(authorization: string | undefined): string | undefined {
  if (!authorization?.startsWith("Bearer ")) return undefined;
  return authorization.slice("Bearer ".length).trim() || undefined;
}
