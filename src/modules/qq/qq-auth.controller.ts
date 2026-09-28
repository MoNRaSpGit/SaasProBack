import { Body, Controller, Headers, HttpCode, HttpStatus, Post, UnauthorizedException } from "@nestjs/common";
import { LoginQqUserDto } from "./dto/login-qq-user.dto";
import { RegisterQqUserDto } from "./dto/register-qq-user.dto";
import { QqAuditService } from "./qq-audit.service";
import { QqAuthService } from "./qq-auth.service";

function extractBearerToken(authorization: string | undefined): string | undefined {
  if (!authorization?.startsWith("Bearer ")) return undefined;
  return authorization.slice("Bearer ".length).trim() || undefined;
}

@Controller("qq/auth")
export class QqAuthController {
  constructor(
    private readonly authService: QqAuthService,
    private readonly auditService: QqAuditService
  ) {}

  @Post("register")
  async register(@Body() dto: RegisterQqUserDto) {
    const result = await this.authService.register(dto);
    await this.auditService.record({
      action: "register",
      entityType: "user",
      entityId: result.user.id,
      entityLabel: result.user.email,
      actor: result.user
    });
    return result;
  }

  @HttpCode(HttpStatus.OK)
  @Post("login")
  async login(@Body() dto: LoginQqUserDto) {
    try {
      const result = await this.authService.login(dto);
      await this.auditService.record({
        action: "login",
        entityType: "user",
        entityId: result.user.id,
        entityLabel: result.user.email,
        actor: result.user
      });
      return result;
    } catch (error) {
      // Intentos fallidos tambien quedan (solo el email que se probo,
      // nunca la contrasena) -- sirve para notar si alguien esta
      // probando entrar a la cuenta de administrador.
      if (error instanceof UnauthorizedException) {
        await this.auditService.record({
          action: "login_failed",
          entityType: "user",
          entityLabel: dto.email.trim().toLowerCase(),
          actor: { email: dto.email.trim().toLowerCase() }
        });
      }
      throw error;
    }
  }

  // Atajo pedido explicitamente (28/09/2026): 5 clicks en el logo del
  // header, sin contrasena. Queda igual auditado que un login normal para
  // poder notar si se usa.
  @HttpCode(HttpStatus.OK)
  @Post("quick-admin-login")
  async quickAdminLogin() {
    const result = await this.authService.quickAdminLogin();
    await this.auditService.record({
      action: "login",
      entityType: "user",
      entityId: result.user.id,
      entityLabel: result.user.email,
      actor: result.user
    });
    return result;
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
