import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { Response } from "express";
import { DatabaseService } from "../database/database.service";

const SERVICE_NAME = "saaspro-backend";
const PROCESS_STARTED_AT = new Date();

function getReleaseSha() {
  return process.env.RELEASE_SHA || process.env.RENDER_GIT_COMMIT || process.env.RENDER_DEPLOY_COMMIT || "local";
}

function getReleaseCreatedAt() {
  return process.env.RELEASE_CREATED_AT || process.env.RENDER_DEPLOY_CREATED_AT || PROCESS_STARTED_AT.toISOString();
}

@Controller("health")
export class HealthController {
  constructor(private readonly databaseService: DatabaseService) {}

  private getMeta() {
    return {
      service: SERVICE_NAME,
      environment: process.env.NODE_ENV || "development",
      version: process.env.APP_VERSION || "0.1.0",
      releaseSha: getReleaseSha(),
      releaseCreatedAt: getReleaseCreatedAt(),
      startedAt: PROCESS_STARTED_AT.toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    };
  }

  @Get("live")
  getLiveness() {
    return {
      status: "ok",
      ...this.getMeta()
    };
  }

  @Get("ready")
  async getReadiness(@Res({ passthrough: true }) response: Response) {
    const dbStatus = await this.databaseService.checkConnectionDetailed();

    if (!dbStatus.ok) {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
      return {
        status: "degraded",
        database: "disconnected",
        ...this.getMeta()
      };
    }

    return {
      status: "ok",
      database: "connected",
      ...this.getMeta()
    };
  }

  @Get("meta")
  getHealthMeta() {
    return this.getMeta();
  }

  @Get()
  async getHealth(@Res({ passthrough: true }) response: Response) {
    const dbStatus = await this.databaseService.checkConnectionDetailed();

    if (!dbStatus.ok) {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
      return {
        status: "degraded",
        database: "disconnected",
        ...this.getMeta()
      };
    }

    return {
      status: "ok",
      database: "connected",
      ...this.getMeta()
    };
  }

  @Get("db")
  async getDatabaseHealth(@Res({ passthrough: true }) response: Response) {
    const dbStatus = await this.databaseService.checkConnectionDetailed();

    if (dbStatus.ok) {
      return {
        status: "ok",
        database: "connected",
        ...this.getMeta()
      };
    }

    response.status(HttpStatus.SERVICE_UNAVAILABLE);
    return {
      status: "error",
      database: "disconnected",
      errorCode: dbStatus.errorCode,
      errorMessage: dbStatus.errorMessage,
      probableCause: dbStatus.probableCause,
      suggestedFix: dbStatus.suggestedFix,
      ...this.getMeta()
    };
  }
}
