import { Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { HttpRequestContext } from "./request-context";

type ContextAwareRequest = Request & HttpRequestContext;

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  use(request: ContextAwareRequest, response: Response, next: NextFunction) {
    const startedAt = Date.now();
    const headerRequestId = request.headers["x-request-id"];
    const requestId =
      typeof headerRequestId === "string" && headerRequestId.trim() ? headerRequestId.trim() : randomUUID();

    request.requestId = requestId;
    response.setHeader("x-request-id", requestId);

    response.on("finish", () => {
      const durationMs = Date.now() - startedAt;
      const forwardedFor = request.headers["x-forwarded-for"];
      const ip = typeof forwardedFor === "string" ? forwardedFor.split(",")[0].trim() : request.ip;
      const level = response.statusCode >= 500 ? "error" : response.statusCode >= 400 ? "warn" : "info";
      const currentUser = request.currentUser;

      console.log(
        JSON.stringify({
          level,
          timestamp: new Date().toISOString(),
          context: "http-request",
          requestId,
          method: request.method,
          path: request.originalUrl || request.url,
          statusCode: response.statusCode,
          durationMs,
          ip,
          userAgent: request.headers["user-agent"] || null,
          tenantId: currentUser?.tenantId || null,
          tenantSlug: currentUser?.tenantSlug || null,
          userId: currentUser?.userId || null,
          membershipRole: currentUser?.membershipRole || null
        })
      );
    });

    next();
  }
}
