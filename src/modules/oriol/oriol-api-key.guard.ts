import { CanActivate, ExecutionContext, Injectable, InternalServerErrorException, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";

// Portado tal cual del original: una unica API key compartida (no hay
// login por usuario). Falla cerrado con 500 si el servidor no tiene
// ORIOL_API_KEY configurada, y con 401 si el header no coincide.
@Injectable()
export class OriolApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expectedKey = process.env.ORIOL_API_KEY;
    if (!expectedKey) {
      throw new InternalServerErrorException("ORIOL_API_KEY no esta configurada en el servidor.");
    }

    const request = context.switchToHttp().getRequest<Request>();
    const providedKey = request.headers["x-oriol-api-key"];

    if (providedKey !== expectedKey) {
      throw new UnauthorizedException("API key invalida.");
    }

    return true;
  }
}
