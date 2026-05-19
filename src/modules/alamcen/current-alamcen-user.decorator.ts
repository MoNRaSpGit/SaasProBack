import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { AlamcenRequestUser } from "./alamcen.types";

type AuthenticatedRequest = Request & {
  currentUser?: AlamcenRequestUser;
};

export const CurrentAlamcenUser = createParamDecorator((_: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
  return request.currentUser;
});
