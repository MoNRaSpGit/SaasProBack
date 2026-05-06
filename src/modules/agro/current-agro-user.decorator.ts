import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { AgroRequestUser } from "./agro.types";

type AuthenticatedRequest = Request & {
  currentUser?: AgroRequestUser;
};

export const CurrentAgroUser = createParamDecorator((_: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
  return request.currentUser;
});
