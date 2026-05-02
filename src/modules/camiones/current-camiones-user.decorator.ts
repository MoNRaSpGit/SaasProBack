import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { CamionesRequestUser } from "./camiones.types";

type AuthenticatedRequest = Request & {
  currentUser?: CamionesRequestUser;
};

export const CurrentCamionesUser = createParamDecorator((_: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
  return request.currentUser;
});
