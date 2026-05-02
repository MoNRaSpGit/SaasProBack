import { Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction) {
    const startedAt = Date.now();

    response.on("finish", () => {
      const durationMs = Date.now() - startedAt;
      const forwardedFor = request.headers["x-forwarded-for"];
      const ip = typeof forwardedFor === "string" ? forwardedFor.split(",")[0].trim() : request.ip;
      const level = response.statusCode >= 500 ? "error" : response.statusCode >= 400 ? "warn" : "info";

      console.log(
        JSON.stringify({
          level,
          timestamp: new Date().toISOString(),
          context: "http-request",
          method: request.method,
          path: request.originalUrl || request.url,
          statusCode: response.statusCode,
          durationMs,
          ip,
          userAgent: request.headers["user-agent"] || null
        })
      );
    });

    next();
  }
}
