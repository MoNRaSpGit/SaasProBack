import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ModuleAuthenticatedRequest, authenticateModuleRequest } from "../../shared/authz/module-auth";
import { DatabaseService } from "../../shared/database/database.service";
import { CamionesRequestUser } from "./camiones.types";

@Injectable()
export class CamionesAuthGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<ModuleAuthenticatedRequest<CamionesRequestUser>>();
    await authenticateModuleRequest(request, "camiones", this.configService, this.databaseService);
    return true;
  }
}
