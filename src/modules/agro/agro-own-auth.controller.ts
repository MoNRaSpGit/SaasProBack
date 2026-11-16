import { Body, Controller, Headers, HttpCode, HttpStatus, Post, UnauthorizedException } from "@nestjs/common";
import { IsString, MaxLength } from "class-validator";
import { AgroOwnAuthService } from "./agro-own-auth.service";

class AgroLoginDto {
  @IsString()
  @MaxLength(190)
  identifier!: string;

  @IsString()
  @MaxLength(200)
  password!: string;
}

class AgroRefreshDto {
  @IsString()
  @MaxLength(200)
  refreshToken!: string;
}

class AgroChangePasswordDto {
  @IsString()
  @MaxLength(200)
  currentPassword!: string;

  @IsString()
  @MaxLength(200)
  newPassword!: string;
}

// Login propio de Agro (17/11/2026). Sin guard: es la puerta de entrada.
@Controller("agro/auth")
export class AgroOwnAuthController {
  constructor(private readonly authService: AgroOwnAuthService) {}

  @HttpCode(HttpStatus.OK)
  @Post("login")
  login(@Body() dto: AgroLoginDto) {
    return this.authService.login(dto.identifier, dto.password);
  }

  @HttpCode(HttpStatus.OK)
  @Post("refresh")
  refresh(@Body() dto: AgroRefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @HttpCode(HttpStatus.OK)
  @Post("logout")
  async logout(@Body() dto: AgroRefreshDto) {
    await this.authService.logout(dto.refreshToken);
    return { ok: true };
  }

  @HttpCode(HttpStatus.OK)
  @Post("change-password")
  changePassword(@Headers("authorization") authorization: string | undefined, @Body() dto: AgroChangePasswordDto) {
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
    if (!token) throw new UnauthorizedException("La sesion vencio. Volve a entrar.");
    return this.authService.changePassword(token, dto.currentPassword, dto.newPassword);
  }
}
