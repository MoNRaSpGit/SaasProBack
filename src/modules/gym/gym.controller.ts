import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post, Put, UnauthorizedException } from "@nestjs/common";
import { LoginGymUserDto } from "./dto/login-gym-user.dto";
import { SaveGymWorkspaceDto } from "./dto/save-gym-workspace.dto";
import { extractBearerToken, GymAuthService } from "./gym-auth.service";
import { GymService } from "./gym.service";

// Login real desde 30/09/2026 (antes "pasaba directo" en fase de pruebas):
// el workspace solo se lee/guarda con una sesion valida.
@Controller("gym")
export class GymController {
  constructor(
    private readonly gymService: GymService,
    private readonly gymAuthService: GymAuthService
  ) {}

  @Get("workspace")
  async getWorkspace(@Headers("authorization") authorization: string | undefined) {
    const user = await this.gymAuthService.requireUser(authorization);
    return this.gymService.getWorkspace(user.workspaceKey);
  }

  @Put("workspace")
  async saveWorkspace(@Headers("authorization") authorization: string | undefined, @Body() dto: SaveGymWorkspaceDto) {
    const user = await this.gymAuthService.requireUser(authorization);
    return this.gymService.saveWorkspace(user.workspaceKey, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post("auth/login")
  async login(@Body() dto: LoginGymUserDto) {
    try {
      const result = await this.gymAuthService.login(dto);
      await this.gymService.recordAudit(result.user.workspaceKey, "login", `Inicio de sesión: ${result.user.fullName ?? result.user.username}`);
      return result;
    } catch (error) {
      // Intentos fallidos tambien quedan (solo el usuario probado, nunca la contrasena).
      // Usuario inexistente -> no se registra en ningun workspace.
      const workspaceKey = error instanceof UnauthorizedException
        ? await this.gymAuthService.findWorkspaceKeyForUsername(dto.username)
        : null;
      if (workspaceKey) {
        await this.gymService.recordAudit(workspaceKey, "login_failed", `Intento fallido de inicio de sesión: ${dto.username.trim()}`);
      }
      throw error;
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post("auth/me")
  async me(@Headers("authorization") authorization: string | undefined) {
    return { user: await this.gymAuthService.requireUser(authorization) };
  }

  @HttpCode(HttpStatus.OK)
  @Post("auth/logout")
  async logout(@Headers("authorization") authorization: string | undefined) {
    const token = extractBearerToken(authorization);
    if (token) await this.gymAuthService.logout(token);
    return { ok: true };
  }
}
