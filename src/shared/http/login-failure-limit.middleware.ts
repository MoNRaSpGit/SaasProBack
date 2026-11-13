import { Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";

// Freno contra adivinar contrasenas (13/11/2026, pedido explicito: "que no
// me llamen 50 clientes diciendo que no pudieron entrar").
//
// Por eso es MUY permisivo con el usuario legitimo:
//  - Solo cuenta los intentos FALLIDOS (respuesta 400/401/403/404). Entrar
//    bien nunca suma, y un login correcto borra el contador.
//  - La clave es IP + ruta + usuario: 20 personas en el mismo wifi, cada una
//    con su usuario, no se molestan entre si.
//  - Recien frena al 10mo fallo seguido en 10 minutos (alguien que se
//    equivoca de clave 2 o 3 veces ni se entera). Frena solo ESE usuario
//    desde ESA IP; despues de la ventana vuelve solo.
//  - Memoria del proceso: si el servidor se reinicia, todo se libera.
//  - Si algo del propio freno falla, deja pasar (nunca bloquea por error).
//
// Cubre todo POST a .../login y .../login-password (gym, joker, juez,
// distribuidora, qq, gps, camisetas, carnet, etc.).
const LOGIN_PATH = /\/(login|login-password)\/?$/i;
const FAILED_STATUSES = new Set([400, 401, 403, 404]);
const USER_FIELDS = ["email", "username", "user", "usuario", "userName", "identifier", "phone", "name", "dni", "cedula"];

type Bucket = { failures: number; resetAt: number };
const store = new Map<string, Bucket>();

function cleanup(now: number) {
  if (store.size < 500) return;
  for (const [key, bucket] of store.entries()) {
    if (bucket.resetAt <= now) store.delete(key);
  }
}

function clientIp(request: Request) {
  const forwardedFor = request.headers["x-forwarded-for"];
  return typeof forwardedFor === "string" ? forwardedFor.split(",")[0].trim() : request.ip || "?";
}

function usernameOf(request: Request) {
  const body = request.body as Record<string, unknown> | undefined;
  if (!body || typeof body !== "object") return "";
  for (const field of USER_FIELDS) {
    const value = body[field];
    if (typeof value === "string" && value.trim()) return value.trim().toLowerCase().slice(0, 120);
  }
  return "";
}

@Injectable()
export class LoginFailureLimitMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction) {
    try {
      if (request.method !== "POST" || !LOGIN_PATH.test((request.originalUrl || request.url).split("?")[0])) {
        next();
        return;
      }

      const maxFailures = Number(process.env.LOGIN_FAIL_MAX || 10);
      const windowMs = Number(process.env.LOGIN_FAIL_WINDOW_MS || 10 * 60_000);
      const now = Date.now();
      cleanup(now);

      const key = `${clientIp(request)}|${(request.originalUrl || request.url).split("?")[0]}|${usernameOf(request)}`;
      const bucket = store.get(key);

      if (bucket && bucket.resetAt > now && bucket.failures >= maxFailures) {
        response.status(429).json({
          statusCode: 429,
          message: "Demasiados intentos fallidos. Esperá unos minutos y probá de nuevo.",
          retryAfterMs: bucket.resetAt - now
        });
        return;
      }

      response.on("finish", () => {
        try {
          const finishedAt = Date.now();
          if (response.statusCode >= 200 && response.statusCode < 300) {
            store.delete(key);
            return;
          }
          if (!FAILED_STATUSES.has(response.statusCode)) return;
          const current = store.get(key);
          if (!current || current.resetAt <= finishedAt) {
            store.set(key, { failures: 1, resetAt: finishedAt + windowMs });
          } else {
            current.failures += 1;
          }
        } catch {
          // El contador nunca rompe nada.
        }
      });
    } catch {
      // Ante cualquier error propio, deja pasar.
    }
    next();
  }
}
