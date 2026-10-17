import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";

// Password unica compartida (no hay usuarios individuales), via env var.
// Ver MOVIMIENTOS_PASSWORD en el deploy de Render.
@Injectable()
export class MovimientosAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.headers["x-movimientos-password"];
    const expected = process.env.MOVIMIENTOS_PASSWORD;

    if (!expected) {
      throw new UnauthorizedException("MOVIMIENTOS_PASSWORD no configurada.");
    }
    if (!provided || typeof provided !== "string" || provided !== expected) {
      throw new UnauthorizedException("Contraseña incorrecta.");
    }

    return true;
  }
}
