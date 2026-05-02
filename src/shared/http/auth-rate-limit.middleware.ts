import { Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const rateLimitStore = new Map<string, RateLimitBucket>();

function cleanupExpiredBuckets(now: number) {
  for (const [key, bucket] of rateLimitStore.entries()) {
    if (bucket.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

@Injectable()
export class AuthRateLimitMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction) {
    const windowMs = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 60_000);
    const maxRequests = Number(process.env.AUTH_RATE_LIMIT_MAX || 20);
    const now = Date.now();

    cleanupExpiredBuckets(now);

    const forwardedFor = request.headers["x-forwarded-for"];
    const ip = typeof forwardedFor === "string" ? forwardedFor.split(",")[0].trim() : request.ip;
    const key = `${ip}:${request.method}:${request.originalUrl || request.url}`;
    const bucket = rateLimitStore.get(key);

    if (!bucket || bucket.resetAt <= now) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (bucket.count >= maxRequests) {
      response.status(429).json({
        statusCode: 429,
        message: "Too many requests",
        retryAfterMs: Math.max(bucket.resetAt - now, 0)
      });
      return;
    }

    bucket.count += 1;
    rateLimitStore.set(key, bucket);
    next();
  }
}
