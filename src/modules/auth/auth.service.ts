import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { compare, hash } from "bcryptjs";
import { createHash, randomUUID } from "node:crypto";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { JwtPayload as BaseJwtPayload, SignOptions, sign, verify } from "jsonwebtoken";
import { DatabaseService } from "../../shared/database/database.service";
import { buildEnabledProductDescriptors } from "../../shared/saas/product-catalog";
import { LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { RegisterDto } from "./dto/register.dto";

type UserRow = RowDataPacket & {
  id: number;
  email: string;
  password_hash: string;
  full_name: string | null;
  role: "owner" | "admin" | "member";
  is_active: number;
};

type RefreshTokenRow = RowDataPacket & {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
};

type TenantMembershipRow = RowDataPacket & {
  tenant_id: number;
  tenant_name: string;
  tenant_slug: string;
  tenant_status: "active" | "suspended" | "archived";
  membership_role: "owner" | "admin" | "operario" | "staff";
  membership_status: "active" | "invited" | "suspended";
  membership_is_default: number;
  billing_status: "active" | "grace_period" | "pending_manual_block" | "blocked";
  paid_until: string | null;
  grace_until: string | null;
  blocked_reason: string | null;
};

type TenantModuleRow = RowDataPacket & {
  module_key: string;
};

type JwtPayload = {
  sub: number;
  email: string;
  role: string;
  tenantId?: number;
  type: "access" | "refresh";
  jti: string;
};

function isAuthJwtPayload(value: BaseJwtPayload): value is BaseJwtPayload & JwtPayload {
  return (
    (typeof value.sub === "number" || typeof value.sub === "string") &&
    typeof value.email === "string" &&
    typeof value.role === "string" &&
    (value.type === "access" || value.type === "refresh")
  );
}

type AuthSessionPayload = {
  user: {
    id: number;
    email: string;
    fullName: string | null;
    role: string;
  };
  tenantContext: {
    tenant: {
      id: number;
      name: string;
      slug: string;
      status: string;
    };
    membership: {
      role: string;
      status: string;
      isDefault: boolean;
    };
    billing: {
      status: "active" | "grace_period" | "pending_manual_block" | "blocked";
      paidUntil: string | null;
      graceUntil: string | null;
      blockedReason: string | null;
    };
    modules: string[];
    products: Array<{
      key: string;
      label: string;
      frontend: string;
    }>;
    preferredFrontend: string | null;
  } | null;
  tokens: {
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    accessTtl: string;
    refreshTtl: string;
  };
};

function normalizeTenantMembershipRole(role: TenantMembershipRow["membership_role"]) {
  return role === "owner" ? "admin" : role;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly configService: ConfigService
  ) {}

  async register(dto: RegisterDto) {
    const email = this.normalizeAuthIdentifier(dto);
    const existing = await this.findUserByEmail(email);
    if (existing) {
      throw new ConflictException("Email already in use");
    }

    const passwordHash = await hash(dto.password, 12);
    await this.db.execute(
      `INSERT INTO saasPro_users (email, password_hash, full_name, role, is_active)
       VALUES (?, ?, ?, 'member', 1)`,
      [email, passwordHash, dto.fullName?.trim() || null]
    );

    const user = await this.findUserByEmail(email);
    if (!user) {
      throw new UnauthorizedException("Unable to create user");
    }

    await this.ensureDefaultTenantContext(user, dto.tenantName?.trim() || dto.fullName?.trim() || null);
    return this.createSession(user);
  }

  async login(dto: LoginDto) {
    const email = this.normalizeAuthIdentifier(dto);
    const user = await this.findUserByEmail(email);
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const matches = await compare(dto.password, user.password_hash);
    if (!matches) {
      throw new UnauthorizedException("Invalid credentials");
    }

    if (!user.is_active) {
      throw new UnauthorizedException("User is inactive");
    }

    return this.createSession(user);
  }

  async refresh(dto: RefreshDto) {
    const refreshSecret = this.getRequiredEnv("JWT_REFRESH_SECRET");
    let payload: JwtPayload;

    try {
      const decoded = verify(dto.refreshToken, refreshSecret);
      if (typeof decoded === "string") {
        throw new UnauthorizedException("Invalid refresh token");
      }
      if (!isAuthJwtPayload(decoded)) {
        throw new UnauthorizedException("Invalid refresh token");
      }
      payload = {
        sub: Number(decoded.sub),
        email: decoded.email,
        role: decoded.role,
        tenantId: typeof decoded.tenantId === "number" ? decoded.tenantId : undefined,
        type: decoded.type,
        jti: typeof decoded.jti === "string" ? decoded.jti : randomUUID()
      };
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (payload.type !== "refresh" || !payload.sub) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (!payload.tenantId) {
      throw new UnauthorizedException("Session expired. Please log in again");
    }

    const tokenHash = this.hashToken(dto.refreshToken);
    const rows = await this.db.query<RefreshTokenRow[]>(
      `SELECT id, user_id, token_hash, expires_at, revoked_at
       FROM saasPro_refresh_tokens
       WHERE user_id = ? AND token_hash = ?
       LIMIT 1`,
      [payload.sub, tokenHash]
    );

    const tokenRow = rows[0];
    if (!tokenRow || tokenRow.revoked_at) {
      throw new UnauthorizedException("Refresh token revoked");
    }

    const user = await this.findUserById(payload.sub);
    if (!user || !user.is_active) {
      throw new UnauthorizedException("User not available");
    }

    await this.db.execute("DELETE FROM saasPro_refresh_tokens WHERE id = ?", [tokenRow.id]);
    return this.createSession(user, payload.tenantId);
  }

  async logout(dto: RefreshDto) {
    const tokenHash = this.hashToken(dto.refreshToken);
    await this.db.execute(
      "UPDATE saasPro_refresh_tokens SET revoked_at = NOW() WHERE token_hash = ? AND revoked_at IS NULL",
      [tokenHash]
    );

    return { success: true };
  }

  private async createSession(user: UserRow, forcedTenantId?: number): Promise<AuthSessionPayload> {
    const accessSecret = this.getRequiredEnv("JWT_ACCESS_SECRET");
    const refreshSecret = this.getRequiredEnv("JWT_REFRESH_SECRET");
    const accessTtl = this.configService.get<string>("JWT_ACCESS_TTL") || "15m";
    const refreshTtl = this.configService.get<string>("JWT_REFRESH_TTL") || "7d";
    const tenantContext = await this.getTenantContext(user.id, forcedTenantId);
    const tenantId = tenantContext?.tenant.id;

    const accessPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId,
      type: "access",
      jti: randomUUID()
    };

    const refreshPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId,
      type: "refresh",
      jti: randomUUID()
    };

    const accessToken = sign(accessPayload, accessSecret, { expiresIn: accessTtl } as SignOptions);
    const refreshToken = sign(refreshPayload, refreshSecret, { expiresIn: refreshTtl } as SignOptions);

    const refreshExpiresAt = this.buildRefreshExpiryDate(refreshTtl);
    await this.db.execute(
      `INSERT INTO saasPro_refresh_tokens (user_id, token_hash, expires_at, revoked_at)
       VALUES (?, ?, ?, NULL)`,
      [user.id, this.hashToken(refreshToken), refreshExpiresAt]
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role
      },
      tenantContext,
      tokens: {
        accessToken,
        refreshToken,
        tokenType: "Bearer",
        accessTtl,
        refreshTtl
      }
    };
  }

  private buildRefreshExpiryDate(ttl: string): Date {
    const now = Date.now();
    const value = Number.parseInt(ttl.slice(0, -1), 10);
    const unit = ttl.slice(-1);

    if (Number.isNaN(value) || value <= 0) {
      return new Date(now + 7 * 24 * 60 * 60 * 1000);
    }

    const multiplierMap: Record<string, number> = {
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000
    };

    const multiplier = multiplierMap[unit] || multiplierMap.d;
    return new Date(now + value * multiplier);
  }

  private hashToken(rawToken: string) {
    return createHash("sha256").update(rawToken).digest("hex");
  }

  private getRequiredEnv(key: string) {
    const value = this.configService.get<string>(key);
    if (!value) {
      throw new UnauthorizedException(`Missing environment variable: ${key}`);
    }
    return value;
  }

  private async findUserByEmail(email: string) {
    const rows = await this.db.query<UserRow[]>(
      `SELECT id, email, password_hash, full_name, role, is_active
       FROM saasPro_users
       WHERE email = ?
       LIMIT 1`,
      [email]
    );
    return rows[0];
  }

  private async findUserById(id: number) {
    const rows = await this.db.query<UserRow[]>(
      `SELECT id, email, password_hash, full_name, role, is_active
       FROM saasPro_users
       WHERE id = ?
       LIMIT 1`,
      [id]
    );
    return rows[0];
  }

  private async ensureDefaultTenantContext(user: UserRow, preferredTenantName: string | null) {
    const coreTablesAvailable = await this.hasSaasCoreTables();
    if (!coreTablesAvailable) {
      return;
    }

    const existingContext = await this.getTenantContext(user.id);
    if (existingContext) {
      return;
    }

    const tenantName = preferredTenantName && preferredTenantName.length > 0 ? preferredTenantName : this.buildTenantNameFromUser(user);
    const tenantSlug = await this.buildUniqueTenantSlug(tenantName);

    await this.db.withTransaction(async (connection) => {
      const [tenantResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO saas_tenants (name, slug, status)
         VALUES (?, ?, 'active')`,
        [tenantName, tenantSlug]
      );

      const tenantId = Number(tenantResult.insertId);
      if (!tenantId) {
        throw new UnauthorizedException("Unable to create tenant context");
      }

      await connection.execute(
        `INSERT INTO saas_tenant_memberships (tenant_id, user_id, role, status, is_default)
         VALUES (?, ?, 'admin', 'active', 1)`,
        [tenantId, user.id]
      );

      await connection.execute(
        `INSERT INTO saas_tenant_settings (tenant_id, brand_name)
         VALUES (?, ?)`,
        [tenantId, tenantName]
      );
    });
  }

  private async getTenantContext(userId: number, preferredTenantId?: number): Promise<AuthSessionPayload["tenantContext"]> {
    const coreTablesAvailable = await this.hasSaasCoreTables();
    if (!coreTablesAvailable) {
      return null;
    }

    const membershipRows = preferredTenantId
      ? await this.db.query<TenantMembershipRow[]>(
          `SELECT
             m.tenant_id,
             t.name AS tenant_name,
             t.slug AS tenant_slug,
             t.status AS tenant_status,
             m.role AS membership_role,
             m.status AS membership_status,
             m.is_default AS membership_is_default,
             s.billing_status,
             s.paid_until,
             s.grace_until,
             s.blocked_reason
           FROM saas_tenant_memberships m
           INNER JOIN saas_tenants t ON t.id = m.tenant_id
           LEFT JOIN saas_tenant_settings s ON s.tenant_id = t.id
           WHERE m.user_id = ?
             AND m.tenant_id = ?
             AND m.status = 'active'
             AND t.status = 'active'
           LIMIT 1`,
          [userId, preferredTenantId]
        )
      : await this.db.query<TenantMembershipRow[]>(
          `SELECT
             m.tenant_id,
             t.name AS tenant_name,
             t.slug AS tenant_slug,
             t.status AS tenant_status,
             m.role AS membership_role,
             m.status AS membership_status,
             m.is_default AS membership_is_default,
             s.billing_status,
             s.paid_until,
             s.grace_until,
             s.blocked_reason
           FROM saas_tenant_memberships m
           INNER JOIN saas_tenants t ON t.id = m.tenant_id
           LEFT JOIN saas_tenant_settings s ON s.tenant_id = t.id
           WHERE m.user_id = ?
             AND m.status = 'active'
             AND t.status = 'active'
           ORDER BY m.is_default DESC, m.id ASC
           LIMIT 1`,
          [userId]
        );

    const membership = membershipRows[0];
    if (!membership) {
      return null;
    }

    const moduleRows = await this.db.query<TenantModuleRow[]>(
      `SELECT module_key
       FROM saas_tenant_modules
       WHERE tenant_id = ? AND enabled = 1
       ORDER BY module_key ASC`,
      [membership.tenant_id]
    );

    const modules = moduleRows.map((row) => row.module_key);
    const products = buildEnabledProductDescriptors(modules);

    return {
      tenant: {
        id: membership.tenant_id,
        name: membership.tenant_name,
        slug: membership.tenant_slug,
        status: membership.tenant_status
      },
      membership: {
        role: normalizeTenantMembershipRole(membership.membership_role),
        status: membership.membership_status,
        isDefault: Boolean(membership.membership_is_default)
      },
      billing: {
        status: membership.billing_status || "active",
        paidUntil: membership.paid_until,
        graceUntil: membership.grace_until,
        blockedReason: membership.blocked_reason
      },
      modules,
      products,
      preferredFrontend: products[0]?.frontend || null
    };
  }

  private async hasSaasCoreTables() {
    try {
      const rows = await this.db.query<Array<RowDataPacket & { table_name: string }>>(
        `SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = DATABASE()
           AND table_name IN ('saas_tenants', 'saas_tenant_memberships', 'saas_tenant_modules', 'saas_tenant_settings')`
      );

      return rows.length === 4;
    } catch {
      return false;
    }
  }

  private buildTenantNameFromUser(user: UserRow) {
    if (user.full_name?.trim()) {
      return user.full_name.trim();
    }

    const localPart = user.email.split("@")[0] || "tenant";
    return localPart.replace(/[._-]+/g, " ").trim() || "tenant";
  }

  private async buildUniqueTenantSlug(rawName: string) {
    const baseSlug = this.slugify(rawName) || `tenant-${randomUUID().slice(0, 8)}`;

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
      const rows = await this.db.query<Array<RowDataPacket & { id: number }>>(
        `SELECT id
         FROM saas_tenants
         WHERE slug = ?
         LIMIT 1`,
        [candidate]
      );

      if (!rows[0]) {
        return candidate;
      }
    }

    return `${baseSlug}-${randomUUID().slice(0, 8)}`;
  }

  private slugify(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120);
  }

  private normalizeAuthIdentifier(dto: { email?: string; username?: string; identifier?: string }) {
    const rawIdentifier = dto.identifier ?? dto.username ?? dto.email;
    const normalizedIdentifier = rawIdentifier?.trim().toLowerCase();

    if (!normalizedIdentifier) {
      throw new UnauthorizedException("Missing login identifier");
    }

    return normalizedIdentifier.includes("@") ? normalizedIdentifier : `${normalizedIdentifier}@saaspro.local`;
  }
}
