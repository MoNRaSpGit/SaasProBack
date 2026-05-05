import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { NeonRequestUser } from "./neon.types";

type AuthenticatedRequest = Request & {
  currentUser?: NeonRequestUser;
};

export const CurrentNeonUser = createParamDecorator((_: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
  return request.currentUser;
});
