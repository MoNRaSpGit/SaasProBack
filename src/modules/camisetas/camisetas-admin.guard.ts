import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { timingSafeEqual } from "crypto";
import type { Request } from "express";

// Proteccion simple (una sola clave compartida, sin usuarios) para las
// rutas de edicion de productos: alcanza para que el cliente no deje la
// pantalla de edicion abierta a cualquiera que entre al link publico.
@Injectable()
export class CamisetasAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const providedKey = request.headers["x-camisetas-admin-key"];
    const expectedKey = process.env.CAMISETAS_ADMIN_PASSWORD;

    if (!expectedKey) {
      throw new UnauthorizedException("CAMISETAS_ADMIN_PASSWORD no esta configurado en el servidor.");
    }

    if (typeof providedKey !== "string" || !safeEquals(providedKey, expectedKey)) {
      throw new UnauthorizedException("Clave de administrador incorrecta.");
    }

    return true;
  }
}

function safeEquals(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
