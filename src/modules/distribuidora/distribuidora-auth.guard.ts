import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ModuleAuthenticatedRequest, authenticateModuleRequest } from "../../shared/authz/module-auth";
import { DatabaseService } from "../../shared/database/database.service";
import { DistribuidoraRequestUser } from "./distribuidora.types";

@Injectable()
export class DistribuidoraAuthGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<ModuleAuthenticatedRequest<DistribuidoraRequestUser>>();
    await authenticateModuleRequest(request, "distribuidora", this.configService, this.databaseService);
    return true;
  }
}
