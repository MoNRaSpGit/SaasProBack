import { describe, expect, it } from "vitest";
import { getCapabilitiesForRole, hasCapability } from "../authz/capabilities";
import { AuthRateLimitMiddleware } from "../http/auth-rate-limit.middleware";

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
});
