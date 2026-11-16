import { Injectable, UnauthorizedException } from "@nestjs/common";
import { compare } from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CamionesRequestUser } from "./camiones.types";

// Login PROPIO de Camiones (17/11/2026): ya no usa el login compartido con
// Agro. Tokens opacos guardados hasheados (sha256) en saas_camiones_sessions.
// El refresh NO es de un solo uso (renueva el acceso y deja el mismo refresh):
// asi dos pestanas o pedidos en paralelo no se cierran la sesion entre si.
const ACCESS_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

type CamionesUserRow = RowDataPacket & {
  id: number;
  username: string;
  legacy_email: string | null;
  password_hash: string;
  full_name: string | null;
  role: string;
  tenant_id: number;
  tenant_name: string;
  tenant_slug: string;
  is_active: number;
};

type SessionRow = RowDataPacket & { id: number; user_id: number };

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const newToken = () => randomBytes(32).toString("hex");

// "Lamilagrosa", "lamilagrosa@saaspro.local" o el mail viejo: todo lleva al
// mismo usuario, asi el que tenia la cuenta recordada no nota el cambio.
function normalizeIdentifier(raw: string) {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value) throw new UnauthorizedException("Falta el usuario.");
  return value;
}

@Injectable()
export class CamionesAuthService {
  constructor(private readonly databaseService: DatabaseService) {}

  private async findByIdentifier(identifier: string) {
    const value = normalizeIdentifier(identifier);
    const shortName = value.endsWith("@saaspro.local") ? value.slice(0, -"@saaspro.local".length) : value;
    const rows = await this.databaseService.query<CamionesUserRow[]>(
      `SELECT * FROM saas_camiones_users WHERE username = ? OR username = ? OR legacy_email = ? LIMIT 1`,
      [value, shortName, value]
    );
    return rows[0] ?? null;
  }

  private buildSession(user: CamionesUserRow, accessToken: string, refreshToken: string) {
    return {
      user: { id: user.id, email: user.username, fullName: user.full_name, role: "user" },
      tenantContext: {
        tenant: { id: user.tenant_id, name: user.tenant_name, slug: user.tenant_slug, status: "active" },
        membership: { role: user.role, status: "active", isDefault: true },
        billing: { status: "active" as const, paidUntil: null, graceUntil: null, blockedReason: null },
        modules: ["camiones"]
      },
      tokens: { accessToken, refreshToken, tokenType: "Bearer", accessTtl: "12h", refreshTtl: "30d" }
    };
  }

  async login(identifier: string, password: string) {
    const user = await this.findByIdentifier(identifier);
    if (!user || !user.is_active || !(await compare(password ?? "", user.password_hash))) {
      throw new UnauthorizedException("Usuario o contraseña incorrectos.");
    }
    const accessToken = newToken();
    const refreshToken = newToken();
    await this.databaseService.execute(
      `INSERT INTO saas_camiones_sessions (user_id, access_hash, access_expires_at, refresh_hash, refresh_expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [user.id, hashToken(accessToken), new Date(Date.now() + ACCESS_TTL_MS), hashToken(refreshToken), new Date(Date.now() + REFRESH_TTL_MS)]
    );
    return this.buildSession(user, accessToken, refreshToken);
  }

  async refresh(refreshToken: string) {
    const rows = await this.databaseService.query<SessionRow[]>(
      `SELECT id, user_id FROM saas_camiones_sessions
       WHERE refresh_hash = ? AND revoked_at IS NULL AND refresh_expires_at > NOW() LIMIT 1`,
      [hashToken(refreshToken ?? "")]
    );
    const session = rows[0];
    if (!session) throw new UnauthorizedException("La sesión venció. Volvé a entrar.");
    const users = await this.databaseService.query<CamionesUserRow[]>(`SELECT * FROM saas_camiones_users WHERE id = ? LIMIT 1`, [session.user_id]);
    const user = users[0];
    if (!user || !user.is_active) throw new UnauthorizedException("La sesión venció. Volvé a entrar.");
    const accessToken = newToken();
    await this.databaseService.execute(`UPDATE saas_camiones_sessions SET access_hash = ?, access_expires_at = ? WHERE id = ?`, [
      hashToken(accessToken),
      new Date(Date.now() + ACCESS_TTL_MS),
      session.id
    ]);
    return this.buildSession(user, accessToken, refreshToken);
  }

  async logout(refreshToken: string) {
    if (!refreshToken) return;
    await this.databaseService.execute(`UPDATE saas_camiones_sessions SET revoked_at = NOW() WHERE refresh_hash = ? AND revoked_at IS NULL`, [
      hashToken(refreshToken)
    ]);
  }

  // Devuelve el usuario si el token es una sesion del login nuevo; null si no lo es
  // (el guard prueba despues con el login viejo mientras dure la transicion).
  async findUserByAccessToken(token: string): Promise<CamionesRequestUser | null> {
    const rows = await this.databaseService.query<CamionesUserRow[]>(
      `SELECT u.* FROM saas_camiones_sessions s
       INNER JOIN saas_camiones_users u ON u.id = s.user_id
       WHERE s.access_hash = ? AND s.revoked_at IS NULL AND s.access_expires_at > NOW() AND u.is_active = 1
       LIMIT 1`,
      [hashToken(token)]
    );
    const user = rows[0];
    if (!user) return null;
    return {
      userId: user.id,
      email: user.username,
      tenantId: user.tenant_id,
      tenantName: user.tenant_name,
      tenantSlug: user.tenant_slug,
      membershipRole: user.role,
      modules: ["camiones"]
    };
  }
}
