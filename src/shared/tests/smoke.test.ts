import { describe, expect, it } from "vitest";
import { getCapabilitiesForRole, hasCapability } from "../authz/capabilities";
import { HealthController } from "../health/health.controller";
import { AuthRateLimitMiddleware } from "../http/auth-rate-limit.middleware";
import { RequestLoggingMiddleware } from "../http/request-logging.middleware";

describe("backend smoke", () => {
  it("rate limits repeated auth requests on the same route", () => {
    process.env.AUTH_RATE_LIMIT_WINDOW_MS = "60000";
    process.env.AUTH_RATE_LIMIT_MAX = "2";

    const middleware = new AuthRateLimitMiddleware();
    let nextCount = 0;

    const request = {
      headers: {},
      ip: "127.0.0.1",
      method: "POST",
      originalUrl: "/auth/login",
      url: "/auth/login"
    } as any;

    const response = {
      statusCode: 200,
      body: null as unknown,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: unknown) {
        this.body = payload;
        return this;
      }
    } as any;

    const next = () => {
      nextCount += 1;
    };

    middleware.use(request, response, next);
    middleware.use(request, response, next);
    middleware.use(request, response, next);

    expect(nextCount).toBe(2);
    expect(response.statusCode).toBe(429);
    expect(response.body).toMatchObject({ message: "Too many requests" });
  });

  it("maps tenant capabilities by role", () => {
    expect(hasCapability("owner", "distribuidora.admin.read")).toBe(true);
    expect(hasCapability("admin", "camiones.trips.pay")).toBe(true);
    expect(hasCapability("staff", "distribuidora.admin.read")).toBe(false);
    expect(hasCapability("operario", "camiones.trips.write")).toBe(true);
    expect(getCapabilitiesForRole("unknown")).toEqual([]);
  });

  it("assigns a request id and exposes it in the response header", () => {
    const middleware = new RequestLoggingMiddleware();
    const headers = new Map<string, string>();

    const request = {
      headers: {},
      ip: "127.0.0.1",
      method: "GET",
      originalUrl: "/health",
      url: "/health"
    } as any;

    const response = {
      statusCode: 200,
      on() {
        return this;
      },
      setHeader(name: string, value: string) {
        headers.set(name.toLowerCase(), value);
      }
    } as any;

    middleware.use(request, response, () => {});

    expect(typeof request.requestId).toBe("string");
    expect(request.requestId.length).toBeGreaterThan(10);
    expect(headers.get("x-request-id")).toBe(request.requestId);
  });

  it("reports liveness, readiness and release metadata", async () => {
    process.env.APP_VERSION = "1.2.3";
    process.env.RELEASE_SHA = "abc123";
    process.env.RELEASE_CREATED_AT = "2026-05-02T12:00:00Z";

    const controller = new HealthController({
      checkConnectionDetailed: async () => ({ ok: true })
    } as any);

    const live = controller.getLiveness();
    const readyResponse = {
      statusCode: 200,
      status(code: number) {
        this.statusCode = code;
        return this;
      }
    } as any;
    const ready = await controller.getReadiness(readyResponse);
    const meta = controller.getHealthMeta();

    expect(live).toMatchObject({
      status: "ok",
      service: "saaspro-backend",
      version: "1.2.3",
      releaseSha: "abc123"
    });
    expect(readyResponse.statusCode).toBe(200);
    expect(ready).toMatchObject({
      status: "ok",
      database: "connected",
      releaseCreatedAt: "2026-05-02T12:00:00Z"
    });
    expect(meta).toMatchObject({
      environment: process.env.NODE_ENV || "test",
      version: "1.2.3",
      releaseSha: "abc123"
    });
    expect(typeof meta.uptimeSeconds).toBe("number");
    expect(typeof meta.startedAt).toBe("string");
    expect(typeof meta.timestamp).toBe("string");
  });
});
