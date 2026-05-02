import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { Response } from "express";
import { DatabaseService } from "../database/database.service";

@Controller("health")
export class HealthController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Get()
  async getHealth(@Res({ passthrough: true }) response: Response) {
    const dbStatus = await this.databaseService.checkConnectionDetailed();

    if (!dbStatus.ok) {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
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
  async getDatabaseHealth(@Res({ passthrough: true }) response: Response) {
    const dbStatus = await this.databaseService.checkConnectionDetailed();

    if (dbStatus.ok) {
      return {
        status: "ok",
        database: "connected"
      };
    }

    response.status(HttpStatus.SERVICE_UNAVAILABLE);
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
