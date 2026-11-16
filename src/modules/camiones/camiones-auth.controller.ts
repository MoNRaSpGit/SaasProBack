import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { IsString, MaxLength } from "class-validator";
import { CamionesAuthService } from "./camiones-auth.service";

class CamionesLoginDto {
  @IsString()
  @MaxLength(190)
  identifier!: string;

  @IsString()
  @MaxLength(200)
  password!: string;
}

class CamionesRefreshDto {
  @IsString()
  @MaxLength(200)
  refreshToken!: string;
}

// Login propio de Camiones (17/11/2026). Sin guard: es la puerta de entrada.
@Controller("camiones/auth")
export class CamionesAuthController {
  constructor(private readonly camionesAuthService: CamionesAuthService) {}

  @HttpCode(HttpStatus.OK)
  @Post("login")
  login(@Body() dto: CamionesLoginDto) {
    return this.camionesAuthService.login(dto.identifier, dto.password);
  }

  @HttpCode(HttpStatus.OK)
  @Post("refresh")
  refresh(@Body() dto: CamionesRefreshDto) {
    return this.camionesAuthService.refresh(dto.refreshToken);
  }

  @HttpCode(HttpStatus.OK)
  @Post("logout")
  async logout(@Body() dto: CamionesRefreshDto) {
    await this.camionesAuthService.logout(dto.refreshToken);
    return { ok: true };
  }
}
