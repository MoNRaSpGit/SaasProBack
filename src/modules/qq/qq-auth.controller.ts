import { Body, Controller, Headers, HttpCode, HttpStatus, Post, UnauthorizedException } from "@nestjs/common";
import { LoginQqUserDto } from "./dto/login-qq-user.dto";
import { RegisterQqUserDto } from "./dto/register-qq-user.dto";
import { QqAuthService } from "./qq-auth.service";

function extractBearerToken(authorization: string | undefined): string | undefined {
  if (!authorization?.startsWith("Bearer ")) return undefined;
  return authorization.slice("Bearer ".length).trim() || undefined;
}

@Controller("qq/auth")
export class QqAuthController {
  constructor(private readonly authService: QqAuthService) {}

  @Post("register")
  register(@Body() dto: RegisterQqUserDto) {
    return this.authService.register(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post("login")
  login(@Body() dto: LoginQqUserDto) {
    return this.authService.login(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post("logout")
  async logout(@Headers("authorization") authorization: string | undefined) {
    const token = extractBearerToken(authorization);
    if (!token) return { ok: true } as const;
    return this.authService.logout(token);
  }

  @HttpCode(HttpStatus.OK)
  @Post("me")
  async me(@Headers("authorization") authorization: string | undefined) {
    const token = extractBearerToken(authorization);
    const user = await this.authService.getUserForToken(token);
    if (!user) {
      throw new UnauthorizedException("Sesión inválida o vencida");
    }
    return { user };
  }
}
