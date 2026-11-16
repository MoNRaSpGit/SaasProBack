import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { compare, hash } from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { AgroRequestUser } from "./agro.types";

// Login PROPIO de Agro (17/11/2026), separado del de Camiones.
// UNA sola sesion por usuario: al entrar se revocan las anteriores con motivo
// 'replaced'. El dispositivo viejo recibe SESSION_REPLACED en su proximo pedido
// y vuelve al login; lo que no estaba guardado se descarta (pedido explicito).
// El refresh NO es de un solo uso (evita el bug viejo de pestanas que se
// cerraban la sesion entre si).
const ACCESS_TTL_MS = 12 * 60 * 60 * 1000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_REPLACED = "SESSION_REPLACED";

type AgroUserRow = RowDataPacket & {
  id: number;
  username: string;
  password_hash: string;
  full_name: string | null;
  role: string;
  tenant_id: number;
  tenant_name: string;
  tenant_slug: string;
  is_active: number;
};

type SessionRow = RowDataPacket & { id: number; user_id: number; revoked_at: Date | null; revoked_reason: string | null; expired: number };

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const newToken = () => randomBytes(32).toString("hex");

function normalizeIdentifier(raw: string) {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value) throw new UnauthorizedException("Falta el usuario.");
  return value.endsWith("@saaspro.local") ? value.slice(0, -"@saaspro.local".length) : value;
}

@Injectable()
export class AgroOwnAuthService {
  constructor(private readonly databaseService: DatabaseService) {}

  private async findUserById(id: number) {
    const rows = await this.databaseService.query<AgroUserRow[]>(`SELECT * FROM saas_agro_users WHERE id = ? LIMIT 1`, [id]);
    return rows[0] ?? null;
  }

  private buildSession(user: AgroUserRow, accessToken: string, refreshToken: string) {
    return {
      user: { id: user.id, email: user.username, fullName: user.full_name, role: "user" },
      tenantContext: {
        tenant: { id: user.tenant_id, name: user.tenant_name, slug: user.tenant_slug, status: "active" },
        membership: { role: user.role, status: "active", isDefault: true },
        billing: { status: "active" as const, paidUntil: null, graceUntil: null, blockedReason: null },
        modules: ["agro"],
        products: [],
        preferredFrontend: null
      },
      tokens: { accessToken, refreshToken, tokenType: "Bearer", accessTtl: "12h", refreshTtl: "30d" }
    };
  }

  async login(identifier: string, password: string) {
    const rows = await this.databaseService.query<AgroUserRow[]>(`SELECT * FROM saas_agro_users WHERE username = ? LIMIT 1`, [
      normalizeIdentifier(identifier)
    ]);
    const user = rows[0];
    if (!user || !user.is_active || !(await compare(password ?? "", user.password_hash))) {
      throw new UnauthorizedException("Cuenta o contrasena incorrecta.");
    }
    // Una sola sesion: el que entra deja afuera a los anteriores.
    await this.databaseService.execute(
      `UPDATE saas_agro_sessions SET revoked_at = NOW(), revoked_reason = 'replaced' WHERE user_id = ? AND revoked_at IS NULL`,
      [user.id]
    );
    const accessToken = newToken();
    const refreshToken = newToken();
    await this.databaseService.execute(
      `INSERT INTO saas_agro_sessions (user_id, access_hash, access_expires_at, refresh_hash, refresh_expires_at) VALUES (?, ?, ?, ?, ?)`,
      [user.id, hashToken(accessToken), new Date(Date.now() + ACCESS_TTL_MS), hashToken(refreshToken), new Date(Date.now() + REFRESH_TTL_MS)]
    );
    return this.buildSession(user, accessToken, refreshToken);
  }

  private async findSession(column: "access_hash" | "refresh_hash", token: string) {
    const expiresColumn = column === "access_hash" ? "access_expires_at" : "refresh_expires_at";
    const rows = await this.databaseService.query<SessionRow[]>(
      `SELECT id, user_id, revoked_at, revoked_reason, (${expiresColumn} <= NOW()) AS expired
       FROM saas_agro_sessions WHERE ${column} = ? LIMIT 1`,
      [hashToken(token)]
    );
    const session = rows[0];
    if (!session) return null;
    if (session.revoked_at) {
      if (session.revoked_reason === "replaced") throw new UnauthorizedException(SESSION_REPLACED);
      throw new UnauthorizedException("La sesion se cerro. Volve a entrar.");
    }
    if (Number(session.expired) === 1) throw new UnauthorizedException("La sesion vencio. Volve a entrar.");
    return session;
  }

  async refresh(refreshToken: string) {
    const session = await this.findSession("refresh_hash", refreshToken ?? "");
    if (!session) throw new UnauthorizedException("La sesion vencio. Volve a entrar.");
    const user = await this.findUserById(session.user_id);
    if (!user || !user.is_active) throw new UnauthorizedException("La sesion vencio. Volve a entrar.");
    const accessToken = newToken();
    await this.databaseService.execute(`UPDATE saas_agro_sessions SET access_hash = ?, access_expires_at = ? WHERE id = ?`, [
      hashToken(accessToken),
      new Date(Date.now() + ACCESS_TTL_MS),
      session.id
    ]);
    return this.buildSession(user, accessToken, refreshToken);
  }

  async logout(refreshToken: string) {
    if (!refreshToken) return;
    await this.databaseService.execute(
      `UPDATE saas_agro_sessions SET revoked_at = NOW(), revoked_reason = 'logout' WHERE refresh_hash = ? AND revoked_at IS NULL`,
      [hashToken(refreshToken)]
    );
  }

  async changePassword(accessToken: string, currentPassword: string, newPassword: string) {
    const user = await this.findUserByAccessToken(accessToken);
    if (!user) throw new UnauthorizedException("La sesion vencio. Volve a entrar.");
    const row = await this.findUserById(user.userId);
    if (!row || !(await compare(currentPassword ?? "", row.password_hash))) {
      throw new UnauthorizedException("La contrasena actual no es correcta.");
    }
    if ((newPassword ?? "").trim().length < 4) throw new BadRequestException("La nueva contrasena debe tener al menos 4 caracteres.");
    await this.databaseService.execute(`UPDATE saas_agro_users SET password_hash = ? WHERE id = ?`, [await hash(newPassword, 12), row.id]);
    // Cierra las demas sesiones de ese usuario, deja la actual.
    await this.databaseService.execute(
      `UPDATE saas_agro_sessions SET revoked_at = NOW(), revoked_reason = 'password' WHERE user_id = ? AND revoked_at IS NULL AND access_hash <> ?`,
      [row.id, hashToken(accessToken)]
    );
    return { success: true };
  }

  // null = el token no es de este login (el guard prueba el viejo mientras dure
  // la transicion). Si la sesion fue reemplazada, tira SESSION_REPLACED.
  async findUserByAccessToken(token: string): Promise<AgroRequestUser | null> {
    const session = await this.findSession("access_hash", token);
    if (!session) return null;
    const user = await this.findUserById(session.user_id);
    if (!user || !user.is_active) throw new UnauthorizedException("La sesion se cerro. Volve a entrar.");
    return {
      userId: user.id,
      email: user.username,
      tenantId: user.tenant_id,
      tenantName: user.tenant_name,
      tenantSlug: user.tenant_slug,
      membershipRole: user.role,
      modules: ["agro"]
    };
  }
}
