import { ConflictException, Injectable, OnModuleInit, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { compare, hash } from "bcryptjs";
import { createHash, randomUUID } from "node:crypto";
import { RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { MailService } from "../../shared/mail/mail.service";
import { ConfirmJuezEmailDto } from "./dto/confirm-juez-email.dto";
import { LoginJuezDto } from "./dto/login-juez.dto";
import { JuezRole, RegisterJuezDto } from "./dto/register-juez.dto";

type JuezAccountRow = RowDataPacket & {
  id: number;
  email: string;
  password_hash: string;
  full_name: string | null;
  city: string | null;
  roles_json: string;
  account_role: "admin" | "juez";
  is_verified: number;
  verification_token_hash: string | null;
  verification_expires_at: string | null;
  verified_at: string | null;
  last_login_at: string | null;
};

type JuezUser = {
  id: number;
  email: string;
  fullName: string | null;
  city: string | null;
  roles: JuezRole[];
  accountRole: "admin" | "juez";
  verifiedAt: string | null;
};

@Injectable()
export class JuezAuthService implements OnModuleInit {
  private ensureTablesPromise: Promise<void> | null = null;

  constructor(
    private readonly db: DatabaseService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService
  ) {}

  async onModuleInit() {
    await this.ensureTables();
    await this.ensureDefaultAdminAccount();
  }

  async register(dto: RegisterJuezDto) {
    await this.ensureTables();
    const email = this.normalizeEmail(dto.email);
    const existing = await this.findAccountByEmail(email);

    if (existing?.is_verified) {
      throw new ConflictException("Email already in use");
    }

    const verificationToken = randomUUID();
    const verificationTokenHash = this.hashToken(verificationToken);
    const verificationExpiresAt = this.buildVerificationExpiryDate();
    const passwordHash = await hash(dto.password, 12);
    const rolesJson = JSON.stringify(this.normalizeRoles(dto.roles));
    const city = dto.city.trim();
    const fullName = dto.fullName.trim();
    const redirectUrl = this.buildRedirectUrl(dto.redirectUrl);

    if (existing) {
      await this.db.execute(
        `UPDATE juez_accounts
         SET password_hash = ?,
             full_name = ?,
             city = ?,
             roles_json = ?,
             account_role = 'juez',
             is_verified = 0,
             verified_at = NULL,
             verification_token_hash = ?,
             verification_expires_at = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [passwordHash, fullName, city, rolesJson, verificationTokenHash, verificationExpiresAt, existing.id]
      );
    } else {
      await this.db.execute(
        `INSERT INTO juez_accounts
         (email, password_hash, full_name, city, roles_json, account_role, is_verified, verification_token_hash, verification_expires_at)
         VALUES (?, ?, ?, ?, ?, 'juez', 0, ?, ?)`,
        [email, passwordHash, fullName, city, rolesJson, verificationTokenHash, verificationExpiresAt]
      );
    }

    await this.mailService.sendJudgeVerificationEmail(
      email,
      fullName,
      `${redirectUrl}?token=${encodeURIComponent(verificationToken)}`
    );

    return {
      success: true,
      verificationRequired: true
    };
  }

  async login(dto: LoginJuezDto) {
    await this.ensureTables();
    const email = this.normalizeEmail(dto.email);
    const account = await this.findAccountByEmail(email);

    if (!account) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const matches = await compare(dto.password, account.password_hash);
    if (!matches) {
      throw new UnauthorizedException("Invalid credentials");
    }

    await this.db.execute("UPDATE juez_accounts SET last_login_at = NOW() WHERE id = ?", [account.id]);
    return { user: this.toUser(account) };
  }

  async confirmEmail(dto: ConfirmJuezEmailDto) {
    await this.ensureTables();
    const tokenHash = this.hashToken(dto.token.trim());
    const rows = await this.db.query<JuezAccountRow[]>(
      `SELECT id, email, password_hash, full_name, city, roles_json, account_role, is_verified, verification_token_hash, verification_expires_at, verified_at, last_login_at
       FROM juez_accounts
       WHERE verification_token_hash = ?
       LIMIT 1`,
      [tokenHash]
    );

    const account = rows[0];
    if (!account) {
      throw new UnauthorizedException("Invalid verification token");
    }

    if (account.verification_expires_at && new Date(account.verification_expires_at).getTime() < Date.now()) {
      throw new UnauthorizedException("Verification token expired");
    }

    if (account.is_verified) {
      return { success: true, alreadyVerified: true, user: this.toUser(account) };
    }

    await this.db.execute(
      `UPDATE juez_accounts
       SET is_verified = 1,
           verified_at = NOW(),
           verification_token_hash = NULL,
           verification_expires_at = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [account.id]
    );

    const verifiedAccount = await this.findAccountByEmail(account.email);
    return { success: true, user: verifiedAccount ? this.toUser(verifiedAccount) : null };
  }

  private async ensureDefaultAdminAccount() {
    const adminEmail = "admin";
    const existing = await this.findAccountByEmail(adminEmail);
    if (existing) {
      return;
    }

    const passwordHash = await hash("admin", 12);
    await this.db.execute(
      `INSERT INTO juez_accounts
       (email, password_hash, full_name, city, roles_json, account_role, is_verified, verified_at)
       VALUES (?, ?, ?, ?, ?, 'admin', 1, NOW())`,
      [adminEmail, passwordHash, "Administrador", "Sistema", JSON.stringify(["principal", "secundario", "planillero"])]
    );
  }

  private async ensureTables() {
    if (!this.ensureTablesPromise) {
      this.ensureTablesPromise = this.createTables();
    }

    await this.ensureTablesPromise;
  }

  private async createTables() {
    await this.db.execute(
      `CREATE TABLE IF NOT EXISTS juez_accounts (
         id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
         email VARCHAR(191) NOT NULL,
         password_hash VARCHAR(255) NOT NULL,
         full_name VARCHAR(120) NULL,
         city VARCHAR(120) NULL,
         roles_json TEXT NOT NULL,
         account_role ENUM('admin', 'juez') NOT NULL DEFAULT 'juez',
         is_verified TINYINT(1) NOT NULL DEFAULT 0,
         verification_token_hash VARCHAR(255) NULL,
         verification_expires_at DATETIME NULL,
         verified_at DATETIME NULL,
         last_login_at DATETIME NULL,
         created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
         updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
         PRIMARY KEY (id),
         UNIQUE KEY uq_juez_accounts_email (email),
         KEY idx_juez_accounts_token_hash (verification_token_hash),
         KEY idx_juez_accounts_verified (is_verified, verified_at)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
  }

  private async findAccountByEmail(email: string) {
    const rows = await this.db.query<JuezAccountRow[]>(
      `SELECT id, email, password_hash, full_name, city, roles_json, account_role, is_verified, verification_token_hash, verification_expires_at, verified_at, last_login_at
       FROM juez_accounts
       WHERE email = ?
       LIMIT 1`,
      [email]
    );

    return rows[0] ?? null;
  }

  private toUser(account: JuezAccountRow): JuezUser {
    return {
      id: account.id,
      email: account.email,
      fullName: account.full_name,
      city: account.city,
      roles: this.parseRoles(account.roles_json),
      accountRole: account.account_role,
      verifiedAt: account.verified_at
    };
  }

  private normalizeRoles(roles: JuezRole[]) {
    const allowedRoles: JuezRole[] = ["principal", "secundario", "planillero"];
    const unique = Array.from(new Set(roles)).filter((role): role is JuezRole => allowedRoles.includes(role));

    return unique.length ? unique : (["principal"] as JuezRole[]);
  }

  private parseRoles(raw: string): JuezRole[] {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return ["principal"];
      }

      const parsedRoles = parsed.filter(
        (value): value is JuezRole => typeof value === "string" && ["principal", "secundario", "planillero"].includes(value)
      ) as JuezRole[];
      return this.normalizeRoles(parsedRoles);
    } catch {
      return ["principal"];
    }
  }

  private normalizeEmail(email: string) {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      throw new UnauthorizedException("Missing email");
    }

    return normalized;
  }

  private hashToken(rawToken: string) {
    return createHash("sha256").update(rawToken).digest("hex");
  }

  private buildVerificationExpiryDate() {
    const ttlHours = Number(this.configService.get<string>("JUEZ_EMAIL_VERIFICATION_TTL_HOURS") || 48);
    return new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  }

  private buildRedirectUrl(overrideUrl?: string) {
    const configured = overrideUrl?.trim() || this.configService.get<string>("JUEZ_FRONTEND_URL")?.trim();
    if (configured) {
      return configured.replace(/\/$/, "");
    }

    return "http://localhost:5173";
  }
}
