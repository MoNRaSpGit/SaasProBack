import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { compare } from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { RowDataPacket } from "mysql2";
import type { Request } from "express";
import { DatabaseService } from "../../shared/database/database.service";

// Login de EME (20/11/2026): usuarios fijos en saas_eme_users (admin y nueva),
// sesiones por token opaco. En la base se guarda el sha256 del token, nunca el token.
const SESSION_TTL_DAYS = 60;

export type EmeUser = { id: number; username: string; role: "admin" | "cliente"; displayName: string };

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

@Injectable()
export class EmeAuthService {
  constructor(private readonly databaseService: DatabaseService) {}

  async login(username: string, password: string): Promise<{ token: string; user: EmeUser }> {
    const rows = await this.databaseService.query<(RowDataPacket & { id: number; username: string; password_hash: string; role: "admin" | "cliente"; display_name: string })[]>(
      `SELECT id, username, password_hash, role, display_name FROM saas_eme_users WHERE username = ? LIMIT 1`,
      [username.trim().toLowerCase()]
    );
    const row = rows[0];
    if (!row || !(await compare(password, row.password_hash))) throw new UnauthorizedException("Usuario o contraseña incorrectos.");
    const token = randomBytes(32).toString("hex");
    await this.databaseService.execute(
      `INSERT INTO saas_eme_sessions (token_hash, user_id, expires_at) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ${SESSION_TTL_DAYS} DAY))`,
      [hashToken(token), row.id]
    );
    return { token, user: { id: row.id, username: row.username, role: row.role, displayName: row.display_name } };
  }

  async userForToken(token: string): Promise<EmeUser | null> {
    if (!token) return null;
    const rows = await this.databaseService.query<(RowDataPacket & { id: number; username: string; role: "admin" | "cliente"; display_name: string })[]>(
      `SELECT u.id, u.username, u.role, u.display_name FROM saas_eme_sessions s JOIN saas_eme_users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP() LIMIT 1`,
      [hashToken(token)]
    );
    const row = rows[0];
    return row ? { id: row.id, username: row.username, role: row.role, displayName: row.display_name } : null;
  }

  async logout(token: string): Promise<void> {
    await this.databaseService.execute(`DELETE FROM saas_eme_sessions WHERE token_hash = ?`, [hashToken(token)]);
  }
}

export function bearerToken(request: Request): string {
  const header = request.headers.authorization ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

// Rutas que no piden sesion (login, aviso de demora, registro de uso).
export const EME_PUBLIC = "eme-public";
export const EmePublic = () => SetMetadata(EME_PUBLIC, true);

@Injectable()
export class EmeAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: EmeAuthService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(EME_PUBLIC, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<Request & { emeUser?: EmeUser }>();
    const user = await this.authService.userForToken(bearerToken(request));
    if (!user) throw new UnauthorizedException("Iniciá sesión.");
    request.emeUser = user;
    return true;
  }
}
