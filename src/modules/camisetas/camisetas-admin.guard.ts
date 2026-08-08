import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { RowDataPacket } from "mysql2/promise";
import { DatabaseService } from "../../shared/database/database.service";

type AdminSessionRow = RowDataPacket & { token: string };

// Guard simple para el panel/productos de camisetas: valida el token de
// sesion contra saas_camisetas_admin_sessions. No expira por ahora (modo
// de prueba, ver docs internas del proyecto).
@Injectable()
export class CamisetasAdminGuard implements CanActivate {
  constructor(private readonly databaseService: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.headers["x-camisetas-admin-token"];

    if (!token || typeof token !== "string") {
      throw new UnauthorizedException("Falta iniciar sesion de administrador.");
    }

    const rows = await this.databaseService.query<AdminSessionRow[]>(
      `SELECT token FROM saas_camisetas_admin_sessions WHERE token = ? LIMIT 1`,
      [token]
    );

    if (!rows[0]) {
      throw new UnauthorizedException("Sesion de administrador invalida.");
    }

    return true;
  }
}
