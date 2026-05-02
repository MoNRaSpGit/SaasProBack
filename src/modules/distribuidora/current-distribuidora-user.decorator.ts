import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { DistribuidoraRequestUser } from "./distribuidora.types";

type AuthenticatedRequest = Request & {
  currentUser?: DistribuidoraRequestUser;
};

export const CurrentDistribuidoraUser = createParamDecorator((_: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
  return request.currentUser;
});
