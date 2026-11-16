import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ModuleAuthenticatedRequest, authenticateModuleRequest } from "../../shared/authz/module-auth";
import { DatabaseService } from "../../shared/database/database.service";
import { CamionesAuthService } from "./camiones-auth.service";
import { CamionesRequestUser } from "./camiones.types";

// 17/11/2026: primero prueba el login PROPIO de Camiones. Si el token no es de
// ese login, prueba el login viejo compartido -- RESPALDO TEMPORAL mientras
// dure la transicion (paso 4 del plan: se saca cuando todo este estable).
@Injectable()
export class CamionesAuthGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
    private readonly camionesAuthService: CamionesAuthService
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<ModuleAuthenticatedRequest<CamionesRequestUser>>();
    const header = request.headers.authorization;
    if (header?.startsWith("Bearer ")) {
      const token = header.slice("Bearer ".length).trim();
      // Los tokens nuevos son 64 caracteres hex; los viejos son JWT (con puntos).
      if (/^[a-f0-9]{64}$/.test(token)) {
        const user = await this.camionesAuthService.findUserByAccessToken(token);
        if (user) {
          request.currentUser = user;
          return true;
        }
      }
    }
    await authenticateModuleRequest(request, "camiones", this.configService, this.databaseService);
    return true;
  }
}
