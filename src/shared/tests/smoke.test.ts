import { describe, expect, it } from "vitest";
import { getCapabilitiesForRole, hasCapability } from "../authz/capabilities";
import { HealthController } from "../health/health.controller";
import { getAllowedCorsOrigins, isCorsOriginAllowed } from "../http/cors";
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
    expect(hasCapability("staff", "agro.shell.read")).toBe(true);
    expect(hasCapability("staff", "agro.discovery.write")).toBe(true);
    expect(hasCapability("admin", "agro.discovery.read")).toBe(true);
    expect(hasCapability("operario", "agro.shell.read")).toBe(true);
    expect(hasCapability("operario", "agro.discovery.write")).toBe(true);
    expect(hasCapability("staff", "camiones.trips.pay")).toBe(true);
    expect(hasCapability("admin", "camiones.trips.pay")).toBe(true);
    expect(hasCapability("admin", "camiones.places.write")).toBe(true);
    expect(hasCapability("operario", "camiones.trips.pay")).toBe(false);
    expect(hasCapability("operario", "camiones.places.read")).toBe(true);
    expect(hasCapability("operario", "camiones.places.write")).toBe(false);
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

  it("falls back to Render release metadata when explicit release env is absent", () => {
    const previousReleaseSha = process.env.RELEASE_SHA;
    const previousReleaseCreatedAt = process.env.RELEASE_CREATED_AT;
    const previousRenderGitCommit = process.env.RENDER_GIT_COMMIT;
    const previousRenderDeployCreatedAt = process.env.RENDER_DEPLOY_CREATED_AT;

    delete process.env.RELEASE_SHA;
    delete process.env.RELEASE_CREATED_AT;
    process.env.RENDER_GIT_COMMIT = "render123";
    process.env.RENDER_DEPLOY_CREATED_AT = "2026-07-01T10:30:00Z";

    const controller = new HealthController({
      checkConnectionDetailed: async () => ({ ok: true })
    } as any);

    expect(controller.getHealthMeta()).toMatchObject({
      releaseSha: "render123",
      releaseCreatedAt: "2026-07-01T10:30:00Z"
    });

    if (previousReleaseSha === undefined) {
      delete process.env.RELEASE_SHA;
    } else {
      process.env.RELEASE_SHA = previousReleaseSha;
    }

    if (previousReleaseCreatedAt === undefined) {
      delete process.env.RELEASE_CREATED_AT;
    } else {
      process.env.RELEASE_CREATED_AT = previousReleaseCreatedAt;
    }

    if (previousRenderGitCommit === undefined) {
      delete process.env.RENDER_GIT_COMMIT;
    } else {
      process.env.RENDER_GIT_COMMIT = previousRenderGitCommit;
    }

    if (previousRenderDeployCreatedAt === undefined) {
      delete process.env.RENDER_DEPLOY_CREATED_AT;
    } else {
      process.env.RENDER_DEPLOY_CREATED_AT = previousRenderDeployCreatedAt;
    }
  });

  it("uses stricter cors defaults by environment", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousAllowedOrigins = process.env.ALLOWED_ORIGINS;

    process.env.ALLOWED_ORIGINS = "";
    process.env.NODE_ENV = "production";

    const productionOrigins = getAllowedCorsOrigins();
    expect(productionOrigins).toEqual(["https://monraspgit.github.io"]);
    expect(isCorsOriginAllowed("https://monraspgit.github.io", productionOrigins)).toBe(true);
    expect(isCorsOriginAllowed("http://localhost:5174", productionOrigins)).toBe(false);

    process.env.NODE_ENV = "development";

    const developmentOrigins = getAllowedCorsOrigins();
    expect(developmentOrigins).toContain("http://localhost:5173");
    expect(developmentOrigins).toContain("http://localhost:5174");
    expect(developmentOrigins).toContain("https://monraspgit.github.io");
    expect(isCorsOriginAllowed(undefined, developmentOrigins)).toBe(true);

    process.env.NODE_ENV = previousNodeEnv;
    process.env.ALLOWED_ORIGINS = previousAllowedOrigins;
  });
});
