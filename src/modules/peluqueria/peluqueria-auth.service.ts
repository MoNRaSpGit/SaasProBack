import { Injectable, UnauthorizedException } from "@nestjs/common";
import { compare } from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { LoginPeluqueriaOwnerDto } from "./dto/login-peluqueria-owner.dto";
import { PeluqueriaOwner } from "./peluqueria.types";

type OwnerRow = RowDataPacket & {
  id: number;
  username: string;
  password_hash: string;
  salon_id: number;
  salon_slug: string;
  salon_name: string;
};

const SESSION_TTL_DAYS = 30;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

// Un hash falso para gastar el mismo tiempo cuando el usuario no existe
// (no revelar por el tiempo de respuesta si el usuario esta cargado o no).
const DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEeO4v4C7Zr0tL0tJvX0Jr0hN5n8Fq0w7Wm";

// Login propio de peluqueria (dueño de un local). Separado del login del resto
// de los proyectos: cada usuario pertenece a UNA peluqueria y solo ve lo suyo.
@Injectable()
export class PeluqueriaAuthService {
  constructor(private readonly databaseService: DatabaseService) {}

  async login(dto: LoginPeluqueriaOwnerDto): Promise<{ user: PeluqueriaOwner; token: string }> {
    const rows = await this.databaseService.query<OwnerRow[]>(
      `SELECT u.id, u.username, u.password_hash, u.salon_id, s.slug AS salon_slug, s.name AS salon_name
       FROM saas_peluqueria_users u JOIN saas_peluqueria_salons s ON s.id = u.salon_id
       WHERE u.username = ? LIMIT 1`,
      [dto.username.trim().toLowerCase()]
    );
    const row = rows[0];
    const matches = await compare(dto.password, row?.password_hash ?? DUMMY_HASH);
    if (!row || !matches) {
      throw new UnauthorizedException("Usuario o contraseña incorrectos");
    }

    const token = randomBytes(32).toString("hex");
    await this.databaseService.execute(`INSERT INTO saas_peluqueria_sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)`, [
      row.id,
      hashToken(token),
      new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)
    ]);
    return { user: this.mapOwner(row), token };
  }

  async logout(token: string): Promise<{ ok: true }> {
    await this.databaseService.execute(`DELETE FROM saas_peluqueria_sessions WHERE token_hash = ?`, [hashToken(token)]);
    return { ok: true };
  }

  async getOwnerForToken(token: string | undefined): Promise<PeluqueriaOwner | null> {
    if (!token) return null;
    const rows = await this.databaseService.query<(OwnerRow & { expires_at: string | Date })[]>(
      `SELECT u.id, u.username, u.password_hash, u.salon_id, s.slug AS salon_slug, s.name AS salon_name, se.expires_at
       FROM saas_peluqueria_sessions se
       JOIN saas_peluqueria_users u ON u.id = se.user_id
       JOIN saas_peluqueria_salons s ON s.id = u.salon_id
       WHERE se.token_hash = ? LIMIT 1`,
      [hashToken(token)]
    );
    const row = rows[0];
    if (!row) return null;
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await this.logout(token);
      return null;
    }
    return this.mapOwner(row);
  }

  private mapOwner(row: OwnerRow): PeluqueriaOwner {
    return { id: row.id, username: row.username, salonId: row.salon_id, salonSlug: row.salon_slug, salonName: row.salon_name };
  }
}
