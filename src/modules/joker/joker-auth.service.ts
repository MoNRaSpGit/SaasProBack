import { Injectable, OnModuleInit, UnauthorizedException } from "@nestjs/common";
import { compare, hash } from "bcryptjs";
import { RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { LoginJokerDto } from "./dto/login-joker.dto";

type JokerRolePasswordRow = RowDataPacket & {
  role: "administrador" | "usuario";
  password_hash: string;
};

// Login bien simple para separar Administrador/Usuario en el mostrador --
// no hay cuentas individuales ni sesion/JWT, solo dos contrasenas fijas
// (una por rol) guardadas hasheadas en la base. No es para reemplazar un
// login de verdad, es para que no entre cualquiera con solo abrir la
// pagina.
@Injectable()
export class JokerAuthService implements OnModuleInit {
  private ensureTablePromise: Promise<void> | null = null;

  constructor(private readonly db: DatabaseService) {}

  async onModuleInit() {
    await this.ensureTable();
    await this.ensureDefaultPasswords();
  }

  async login(dto: LoginJokerDto): Promise<{ ok: true }> {
    await this.ensureTable();

    const rows = await this.db.query<JokerRolePasswordRow[]>(
      `SELECT role, password_hash FROM saas_joker_role_passwords WHERE role = ? LIMIT 1`,
      [dto.role]
    );
    const row = rows[0];
    if (!row) {
      throw new UnauthorizedException("Rol invalido.");
    }

    const matches = await compare(dto.password, row.password_hash);
    if (!matches) {
      throw new UnauthorizedException("Contrasena incorrecta.");
    }

    return { ok: true };
  }

  private async ensureTable() {
    if (!this.ensureTablePromise) {
      this.ensureTablePromise = this.createTable().catch((error) => {
        this.ensureTablePromise = null;
        throw error;
      });
    }

    await this.ensureTablePromise;
  }

  private async createTable() {
    await this.db.execute(
      `CREATE TABLE IF NOT EXISTS saas_joker_role_passwords (
         role ENUM('administrador', 'usuario') NOT NULL,
         password_hash VARCHAR(255) NOT NULL,
         updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
         PRIMARY KEY (role)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
  }

  // Solo carga las contrasenas por defecto la primera vez (tabla recien
  // creada, sin filas) -- si ya hay filas (se cambiaron a mano en la base
  // en algun momento) nunca las pisa.
  private async ensureDefaultPasswords() {
    const rows = await this.db.query<RowDataPacket[]>(`SELECT COUNT(*) as count FROM saas_joker_role_passwords`);
    if (Number(rows[0]?.count ?? 0) > 0) {
      return;
    }

    const adminHash = await hash("joker123", 10);
    const userHash = await hash("mostrador123", 10);
    await this.db.execute(`INSERT INTO saas_joker_role_passwords (role, password_hash) VALUES (?, ?), (?, ?)`, [
      "administrador",
      adminHash,
      "usuario",
      userHash
    ]);
  }
}
