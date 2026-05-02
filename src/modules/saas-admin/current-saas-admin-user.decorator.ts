import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { SaasAdminRequestUser } from "./saas-admin.types";

type AuthenticatedRequest = Request & {
  currentUser?: SaasAdminRequestUser;
};

export const CurrentSaasAdminUser = createParamDecorator((_: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
  return request.currentUser;
});
