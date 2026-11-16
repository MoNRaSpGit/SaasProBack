import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ModuleAuthenticatedRequest } from "../../shared/authz/module-auth";
import { AgroOwnAuthService } from "./agro-own-auth.service";
import { AgroRequestUser } from "./agro.types";

// 17/11/2026: SOLO el login propio de Agro (con la regla de una sola sesion).
// El login viejo compartido ya no se acepta, asi nadie saltea la regla.
@Injectable()
export class AgroAuthGuard implements CanActivate {
  constructor(
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
    throw new UnauthorizedException("La sesion vencio. Volve a entrar.");
  }
}
