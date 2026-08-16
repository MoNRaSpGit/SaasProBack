import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { RowDataPacket } from "mysql2/promise";
import { DatabaseService } from "../../shared/database/database.service";

type AdminSessionRow = RowDataPacket & { token: string };

// Valida el token de sesion (emitido por CarnetService.loginAdmin) contra
// saas_carnet_admin_sessions. Protege las escrituras del panel admin -- ver
// carnet.controller.ts para que rutas quedan detras de este guard.
@Injectable()
export class CarnetAdminGuard implements CanActivate {
  constructor(private readonly databaseService: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.headers["x-carnet-admin-token"];

    if (!token || typeof token !== "string") {
      throw new UnauthorizedException("Falta iniciar sesion de administrador.");
    }

    const rows = await this.databaseService.query<AdminSessionRow[]>(
      `SELECT token FROM saas_carnet_admin_sessions WHERE token = ? LIMIT 1`,
      [token]
    );

    if (!rows[0]) {
      throw new UnauthorizedException("Sesion de administrador invalida.");
    }

    return true;
  }
}
