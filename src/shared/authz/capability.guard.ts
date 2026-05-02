import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { hasCapability, TenantCapability } from "./capabilities";
import { REQUIRED_CAPABILITY_KEY } from "./require-capability.decorator";

type AuthenticatedRequest = {
  currentUser?: {
    membershipRole?: string;
  };
};

@Injectable()
export class CapabilityGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const capability = this.reflector.getAllAndOverride<TenantCapability | undefined>(REQUIRED_CAPABILITY_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!capability) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const membershipRole = request.currentUser?.membershipRole;

    if (!membershipRole || !hasCapability(membershipRole, capability)) {
      throw new ForbiddenException(`Missing capability: ${capability}`);
    }

    return true;
  }
}
