import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { compare, hash } from "bcryptjs";
import { randomBytes } from "node:crypto";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { LoginRopaUserDto } from "./dto/login-ropa-user.dto";
import { RegisterRopaUserDto } from "./dto/register-ropa-user.dto";
import { RopaUser } from "./ropa.types";

type RopaUserRow = RowDataPacket & {
  id: number;
  email: string;
  password_hash: string;
  full_name: string | null;
  role: "administrador" | "usuario";
};

type RopaSessionRow = RowDataPacket & {
  user_id: number;
  expires_at: string | Date;
};

// Sesiones simples por token opaco (no JWT) -- alcanza para esta escala.
// Registrarse por el formulario publico siempre da rol "usuario" -- el
// unico administrador se crea a mano con
// scripts/create-ropa-admin-user.js, nunca por auto-registro.
const SESSION_TTL_DAYS = 30;

@Injectable()
export class RopaAuthService {
  constructor(private readonly databaseService: DatabaseService) {}

  async register(dto: RegisterRopaUserDto): Promise<{ user: RopaUser; token: string }> {
    const existing = await this.databaseService.query<RopaUserRow[]>(
      `SELECT id FROM saas_ropa_users WHERE email = ? LIMIT 1`,
      [dto.email.trim().toLowerCase()]
    );
    if (existing.length) {
      throw new ConflictException("Ya existe una cuenta con ese email");
    }

    const passwordHash = await hash(dto.password, 12);
    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_ropa_users (email, password_hash, full_name, role) VALUES (?, ?, ?, 'usuario')`,
      [dto.email.trim().toLowerCase(), passwordHash, dto.fullName?.trim() || null]
    );

    const user: RopaUser = {
      id: result.insertId,
      email: dto.email.trim().toLowerCase(),
      fullName: dto.fullName?.trim() || null,
      role: "usuario"
    };
    const token = await this.createSession(user.id);
    return { user, token };
  }

  async login(dto: LoginRopaUserDto): Promise<{ user: RopaUser; token: string }> {
    const rows = await this.databaseService.query<RopaUserRow[]>(
      `SELECT id, email, password_hash, full_name, role FROM saas_ropa_users WHERE email = ? LIMIT 1`,
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
    await this.databaseService.execute(`DELETE FROM saas_ropa_sessions WHERE token = ?`, [token]);
    return { ok: true };
  }

  // Usado tanto para "quien soy" (GET /ropa/auth/me) como por el guard que
  // protege alta/edicion/borrado de productos.
  async getUserForToken(token: string | undefined): Promise<RopaUser | null> {
    if (!token) return null;

    const sessionRows = await this.databaseService.query<RopaSessionRow[]>(
      `SELECT user_id, expires_at FROM saas_ropa_sessions WHERE token = ? LIMIT 1`,
      [token]
    );
    const session = sessionRows[0];
    if (!session) return null;
    if (new Date(session.expires_at).getTime() < Date.now()) {
      await this.databaseService.execute(`DELETE FROM saas_ropa_sessions WHERE token = ?`, [token]);
      return null;
    }

    const userRows = await this.databaseService.query<RopaUserRow[]>(
      `SELECT id, email, password_hash, full_name, role FROM saas_ropa_users WHERE id = ? LIMIT 1`,
      [session.user_id]
    );
    const row = userRows[0];
    return row ? this.mapUser(row) : null;
  }

  private async createSession(userId: number): Promise<string> {
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
    await this.databaseService.execute(`INSERT INTO saas_ropa_sessions (user_id, token, expires_at) VALUES (?, ?, ?)`, [
      userId,
      token,
      expiresAt
    ]);
    return token;
  }

  private mapUser(row: RopaUserRow): RopaUser {
    return { id: row.id, email: row.email, fullName: row.full_name, role: row.role };
  }
}
