import { Controller, Get } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

@Controller("health")
export class HealthController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Get()
  async getHealth() {
    const dbStatus = await this.databaseService.checkConnectionDetailed();

    if (!dbStatus.ok) {
      return {
        status: "degraded",
        service: "saaspro-backend",
        database: "disconnected"
      };
    }

    return {
      status: "ok",
      service: "saaspro-backend",
      database: "connected"
    };
  }

  @Get("db")
  async getDatabaseHealth() {
    const dbStatus = await this.databaseService.checkConnectionDetailed();

    if (dbStatus.ok) {
      return {
        status: "ok",
        database: "connected"
      };
    }

    return {
      status: "error",
      database: "disconnected",
      errorCode: dbStatus.errorCode,
      errorMessage: dbStatus.errorMessage,
      probableCause: dbStatus.probableCause,
      suggestedFix: dbStatus.suggestedFix
    };
  }
}
