import { Controller, Get } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

@Controller("health")
export class HealthController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Get()
  async getHealth() {
    try {
      await this.databaseService.checkConnection();
      return {
        status: "ok",
        service: "saaspro-backend",
        database: "connected"
      };
    } catch {
      return {
        status: "degraded",
        service: "saaspro-backend",
        database: "disconnected"
      };
    }
  }
}
