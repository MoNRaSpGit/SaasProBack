import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PoolConnection, createPool, Pool, QueryResult, RowDataPacket } from "mysql2/promise";

type DbConnectionCheckResult = {
  ok: boolean;
  errorCode?: string;
  errorMessage?: string;
  probableCause?: string;
  suggestedFix?: string;
};

type SqlValue = string | number | boolean | null | Date;

function mapDatabaseError(code: string): Pick<DbConnectionCheckResult, "probableCause" | "suggestedFix"> {
  switch (code) {
    case "ECONNREFUSED":
      return {
        probableCause: "El host o puerto de MySQL rechaza la conexion desde Render (firewall/ACL o puerto incorrecto).",
        suggestedFix: "Verifica DB_HOST/DB_PORT y habilita acceso desde la red de Render en Clever Cloud."
      };
    case "ER_ACCESS_DENIED_ERROR":
      return {
        probableCause: "Usuario o password incorrectos, o el usuario no tiene permiso desde ese host/IP.",
        suggestedFix: "Revisar DB_USER/DB_PASSWORD y permisos del usuario para conexiones remotas."
      };
    case "ENOTFOUND":
      return {
        probableCause: "El hostname de la base no se puede resolver por DNS.",
        suggestedFix: "Verifica DB_HOST o usa el host directo de Clever Cloud."
      };
    case "ETIMEDOUT":
      return {
        probableCause: "Timeout de red hacia MySQL (bloqueo o latencia alta).",
        suggestedFix: "Probar host/puerto directos y revisar reglas de red/allowlist."
      };
    default:
      return {
        probableCause: "Fallo de conexion a MySQL no clasificado.",
        suggestedFix: "Revisar variables de entorno y logs completos del deploy."
      };
  }
}

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(private readonly configService: ConfigService) {
    const databaseUrl = this.configService.get<string>("DATABASE_URL");

    if (databaseUrl) {
      this.pool = createPool(databaseUrl);
      return;
    }

    this.pool = createPool({
      host: this.configService.get<string>("DB_HOST"),
      port: Number(this.configService.get<string>("DB_PORT") || 3306),
      database: this.configService.get<string>("DB_NAME"),
      user: this.configService.get<string>("DB_USER"),
      password: this.configService.get<string>("DB_PASSWORD"),
      connectionLimit: 10
    });
  }

  async checkConnection() {
    return this.withTransientRetry(() => this.pool.query("SELECT 1 AS ok"));
  }

  private normalizeValues(values: Array<SqlValue | undefined>) {
    return values.map((value) => value ?? null);
  }

  async query<T extends RowDataPacket[]>(sql: string, values: Array<SqlValue | undefined> = []) {
    const [rows] = await this.withTransientRetry(() => this.pool.query<T>(sql, this.normalizeValues(values)));
    return rows;
  }

  async execute<T extends QueryResult>(sql: string, values: Array<SqlValue | undefined> = []) {
    const [result] = await this.withTransientRetry(() => this.pool.execute<T>(sql, this.normalizeValues(values)));
    return result;
  }

  async withTransaction<T>(callback: (connection: PoolConnection) => Promise<T>) {
    const connection = await this.pool.getConnection();

    try {
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async checkConnectionDetailed(): Promise<DbConnectionCheckResult> {
    try {
      await this.checkConnection();
      return { ok: true };
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string; sqlMessage?: string };
      const errorCode = err.code || "UNKNOWN_DB_ERROR";
      const errorMessage = err.message || err.sqlMessage || "Database connection failed";
      const mapped = mapDatabaseError(errorCode);

      return {
        ok: false,
        errorCode,
        errorMessage,
        probableCause: mapped.probableCause,
        suggestedFix: mapped.suggestedFix
      };
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  private async withTransientRetry<T>(operation: () => Promise<T>, attempt = 0): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const err = error as { code?: string };
      const transientCodes = new Set(["ECONNRESET", "PROTOCOL_CONNECTION_LOST", "ETIMEDOUT", "EPIPE"]);

      if (attempt === 0 && transientCodes.has(err.code ?? "")) {
        return this.withTransientRetry(operation, 1);
      }

      throw error;
    }
  }
}
