import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ModuleAuthenticatedRequest, authenticateModuleRequest } from "../../shared/authz/module-auth";
import { DatabaseService } from "../../shared/database/database.service";
import { AgroOwnAuthService } from "./agro-own-auth.service";
import { AgroRequestUser } from "./agro.types";

// 17/11/2026: primero el login PROPIO de Agro (con la regla de una sola
// sesion). Si el token no es de ese login, prueba el login viejo compartido:
// RESPALDO TEMPORAL solo para el rato del cambio (se saca apenas el frontend
// nuevo este publicado, para que nadie pueda saltear la regla de una sesion).
@Injectable()
export class AgroAuthGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
    private readonly ownAuthService: AgroOwnAuthService
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<ModuleAuthenticatedRequest<AgroRequestUser>>();
    const header = request.headers.authorization;
    if (header?.startsWith("Bearer ")) {
      const token = header.slice("Bearer ".length).trim();
      if (/^[a-f0-9]{64}$/.test(token)) {
        const user = await this.ownAuthService.findUserByAccessToken(token);
        if (user) {
          request.currentUser = user;
          return true;
        }
      }
    }
    await authenticateModuleRequest(request, "agro", this.configService, this.databaseService);
    return true;
  }
}
