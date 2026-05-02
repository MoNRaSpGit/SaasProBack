import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { PosRequestUser } from "./pos.types";

type AuthenticatedRequest = Request & {
  currentUser?: PosRequestUser;
};

export const CurrentPosUser = createParamDecorator((_: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
  return request.currentUser;
});
