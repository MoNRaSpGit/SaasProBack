import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { compare, hash } from "bcryptjs";
import { randomBytes } from "node:crypto";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { LoginQqUserDto } from "./dto/login-qq-user.dto";
import { RegisterQqUserDto } from "./dto/register-qq-user.dto";
import { QqUser } from "./qq.types";

type QqUserRow = RowDataPacket & {
  id: number;
  email: string;
  password_hash: string;
  full_name: string | null;
  role: "administrador" | "usuario";
};

type QqSessionRow = RowDataPacket & {
  user_id: number;
  expires_at: string | Date;
};

// Sesiones simples por token opaco (no JWT) -- alcanza para esta escala.
// Registrarse por el formulario publico siempre da rol "usuario" -- el
// unico administrador se crea a mano con
// scripts/create-qq-admin-user.js, nunca por auto-registro.
const SESSION_TTL_DAYS = 30;

@Injectable()
export class QqAuthService {
  constructor(private readonly databaseService: DatabaseService) {}

  async register(dto: RegisterQqUserDto): Promise<{ user: QqUser; token: string }> {
    const existing = await this.databaseService.query<QqUserRow[]>(
      `SELECT id FROM saas_qq_users WHERE email = ? LIMIT 1`,
      [dto.email.trim().toLowerCase()]
    );
    if (existing.length) {
      throw new ConflictException("Ya existe una cuenta con ese email");
    }

    const passwordHash = await hash(dto.password, 12);
    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_qq_users (email, password_hash, full_name, role) VALUES (?, ?, ?, 'usuario')`,
      [dto.email.trim().toLowerCase(), passwordHash, dto.fullName?.trim() || null]
    );

    const user: QqUser = {
      id: result.insertId,
      email: dto.email.trim().toLowerCase(),
      fullName: dto.fullName?.trim() || null,
      role: "usuario"
    };
    const token = await this.createSession(user.id);
    return { user, token };
  }

  async login(dto: LoginQqUserDto): Promise<{ user: QqUser; token: string }> {
    const rows = await this.databaseService.query<QqUserRow[]>(
      `SELECT id, email, password_hash, full_name, role FROM saas_qq_users WHERE email = ? LIMIT 1`,
      [dto.email.trim().toLowerCase()]
    );
    const row = rows[0];
    if (!row) {
      throw new UnauthorizedException("Email o contraseña incorrectos");
    }

    const matches = await compare(dto.password, row.password_hash);
    if (!matches) {
      throw new UnauthorizedException("Email o contraseña incorrectos");
    }

    const token = await this.createSession(row.id);
    return { user: this.mapUser(row), token };
  }

  async logout(token: string): Promise<{ ok: true }> {
    await this.databaseService.execute(`DELETE FROM saas_qq_sessions WHERE token = ?`, [token]);
    return { ok: true };
  }

  // Usado tanto para "quien soy" (GET /qq/auth/me) como por el guard que
  // protege alta/edicion/borrado de productos.
  async getUserForToken(token: string | undefined): Promise<QqUser | null> {
    if (!token) return null;

    const sessionRows = await this.databaseService.query<QqSessionRow[]>(
      `SELECT user_id, expires_at FROM saas_qq_sessions WHERE token = ? LIMIT 1`,
      [token]
    );
    const session = sessionRows[0];
    if (!session) return null;
    if (new Date(session.expires_at).getTime() < Date.now()) {
      await this.databaseService.execute(`DELETE FROM saas_qq_sessions WHERE token = ?`, [token]);
      return null;
    }

    const userRows = await this.databaseService.query<QqUserRow[]>(
      `SELECT id, email, password_hash, full_name, role FROM saas_qq_users WHERE id = ? LIMIT 1`,
      [session.user_id]
    );
    const row = userRows[0];
    return row ? this.mapUser(row) : null;
  }

  private async createSession(userId: number): Promise<string> {
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
    await this.databaseService.execute(`INSERT INTO saas_qq_sessions (user_id, token, expires_at) VALUES (?, ?, ?)`, [
      userId,
      token,
      expiresAt
    ]);
    return token;
  }

  private mapUser(row: QqUserRow): QqUser {
    return { id: row.id, email: row.email, fullName: row.full_name, role: row.role };
  }
}
