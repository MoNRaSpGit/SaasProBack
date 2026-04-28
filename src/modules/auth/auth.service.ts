import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { compare, hash } from "bcryptjs";
import { createHash, randomUUID } from "node:crypto";
import { RowDataPacket } from "mysql2";
import { JwtPayload as BaseJwtPayload, SignOptions, sign, verify } from "jsonwebtoken";
import { DatabaseService } from "../../shared/database/database.service";
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

type JwtPayload = {
  sub: number;
  email: string;
  role: string;
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

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly configService: ConfigService
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
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

    return this.createSession(user);
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
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
        type: decoded.type,
        jti: typeof decoded.jti === "string" ? decoded.jti : randomUUID()
      };
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (payload.type !== "refresh" || !payload.sub) {
      throw new UnauthorizedException("Invalid refresh token");
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
    return this.createSession(user);
  }

  async logout(dto: RefreshDto) {
    const tokenHash = this.hashToken(dto.refreshToken);
    await this.db.execute(
      "UPDATE saasPro_refresh_tokens SET revoked_at = NOW() WHERE token_hash = ? AND revoked_at IS NULL",
      [tokenHash]
    );

    return { success: true };
  }

  private async createSession(user: UserRow) {
    const accessSecret = this.getRequiredEnv("JWT_ACCESS_SECRET");
    const refreshSecret = this.getRequiredEnv("JWT_REFRESH_SECRET");
    const accessTtl = this.configService.get<string>("JWT_ACCESS_TTL") || "15m";
    const refreshTtl = this.configService.get<string>("JWT_REFRESH_TTL") || "7d";

    const accessPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: "access",
      jti: randomUUID()
    };

    const refreshPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
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
}
