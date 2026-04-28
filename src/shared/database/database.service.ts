import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createPool, Pool } from "mysql2/promise";

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

  async onModuleDestroy() {
    await this.pool.end();
  }
}
