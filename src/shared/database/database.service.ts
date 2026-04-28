import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createPool, Pool } from "mysql2/promise";

type DbConnectionCheckResult = {
  ok: boolean;
  errorCode?: string;
  errorMessage?: string;
};

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
    const [rows] = await this.pool.query("SELECT 1 AS ok");
    return rows;
  }

  async checkConnectionDetailed(): Promise<DbConnectionCheckResult> {
    try {
      await this.checkConnection();
      return { ok: true };
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      return {
        ok: false,
        errorCode: err.code || "UNKNOWN_DB_ERROR",
        errorMessage: err.message || "Database connection failed"
      };
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
