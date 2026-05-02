import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtPayload as BaseJwtPayload, verify } from "jsonwebtoken";
import { SaasAdminRequestUser } from "./saas-admin.types";

type AccessJwtPayload = {
  sub: number | string;
  email: string;
  role: string;
  type: "access" | "refresh";
};

type AuthenticatedRequest = {
  headers: {
    authorization?: string;
  };
  currentUser?: SaasAdminRequestUser;
};

function isAccessJwtPayload(value: BaseJwtPayload): value is BaseJwtPayload & AccessJwtPayload {
  return (
    (typeof value.sub === "number" || typeof value.sub === "string") &&
    typeof value.email === "string" &&
    typeof value.role === "string" &&
    value.type === "access"
  );
}

function canAccessSaasAdmin(role: string) {
  return role === "admin" || role === "owner";
}

@Injectable()
export class SaasAdminAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }

    const token = authHeader.slice("Bearer ".length).trim();
    const accessSecret = this.configService.get<string>("JWT_ACCESS_SECRET");
    if (!accessSecret) {
      throw new UnauthorizedException("Missing access secret");
    }

    let decoded: BaseJwtPayload | string;
    try {
      decoded = verify(token, accessSecret);
    } catch {
      throw new UnauthorizedException("Invalid access token");
    }

    if (typeof decoded === "string" || !isAccessJwtPayload(decoded)) {
      throw new UnauthorizedException("Invalid access token");
    }

    const userId = Number(decoded.sub);
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new UnauthorizedException("Invalid access token");
    }

    if (!canAccessSaasAdmin(decoded.role)) {
      throw new UnauthorizedException("SaaS admin access denied");
    }

    request.currentUser = {
      userId,
      email: decoded.email,
      globalRole: decoded.role
    };

    return true;
  }
}
