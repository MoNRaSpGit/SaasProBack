import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtPayload as BaseJwtPayload, verify } from "jsonwebtoken";
import { RowDataPacket } from "mysql2";
import { DatabaseService } from "../database/database.service";
import { SaasProductKey } from "../saas/product-catalog";

type AccessJwtPayload = {
  sub: number | string;
  email: string;
  role: string;
  type: "access" | "refresh";
};

type MembershipRow = RowDataPacket & {
  tenant_id: number;
  tenant_name: string;
  tenant_slug: string;
  membership_role: string;
  module_key: string | null;
};

export type ModuleRequestUser = {
  userId: number;
  email: string;
  tenantId: number;
  tenantName: string;
  tenantSlug: string;
  membershipRole: string;
  modules: string[];
};

export type ModuleAuthenticatedRequest<TUser extends ModuleRequestUser = ModuleRequestUser> = {
  headers: {
    authorization?: string;
  };
  currentUser?: TUser;
};

function isAccessJwtPayload(value: BaseJwtPayload): value is BaseJwtPayload & AccessJwtPayload {
  return (
    (typeof value.sub === "number" || typeof value.sub === "string") &&
    typeof value.email === "string" &&
    typeof value.role === "string" &&
    value.type === "access"
  );
}

function getProductLabel(moduleKey: SaasProductKey) {
  return moduleKey.charAt(0).toUpperCase() + moduleKey.slice(1);
}

export async function authenticateModuleRequest<TUser extends ModuleRequestUser = ModuleRequestUser>(
  request: ModuleAuthenticatedRequest<TUser>,
  moduleKey: SaasProductKey,
  configService: ConfigService,
  databaseService: DatabaseService
) {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    throw new UnauthorizedException("Missing bearer token");
  }

  const token = authHeader.slice("Bearer ".length).trim();
  const accessSecret = configService.get<string>("JWT_ACCESS_SECRET");
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

  const rows = await databaseService.query<MembershipRow[]>(
    `SELECT
       m.tenant_id,
       t.name AS tenant_name,
       t.slug AS tenant_slug,
       m.role AS membership_role,
       tm.module_key
     FROM saasPro_users u
     INNER JOIN saas_tenant_memberships m
       ON m.user_id = u.id
      AND m.status = 'active'
     INNER JOIN saas_tenants t
       ON t.id = m.tenant_id
      AND t.status = 'active'
     LEFT JOIN saas_tenant_modules tm
       ON tm.tenant_id = m.tenant_id
      AND tm.enabled = 1
     WHERE u.id = ?
       AND u.is_active = 1
     ORDER BY m.is_default DESC, m.id ASC`,
    [userId]
  );

  if (!rows[0]) {
    throw new UnauthorizedException("User has no active tenant");
  }

  const firstRow = rows[0];
  const modules = Array.from(
    new Set(rows.map((row) => row.module_key).filter((value): value is string => Boolean(value)))
  );

  if (!modules.includes(moduleKey)) {
    throw new UnauthorizedException(`${getProductLabel(moduleKey)} module is not enabled for this tenant`);
  }

  const currentUser = {
    userId,
    email: decoded.email,
    tenantId: firstRow.tenant_id,
    tenantName: firstRow.tenant_name,
    tenantSlug: firstRow.tenant_slug,
    membershipRole: firstRow.membership_role,
    modules
  } as TUser;

  request.currentUser = currentUser;
  return currentUser;
}
