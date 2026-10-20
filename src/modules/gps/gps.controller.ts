import { BadRequestException, Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, Post, Query } from "@nestjs/common";
import { LoginGpsPasswordDto } from "./dto/login-gps-password.dto";
import { LoginGpsUserDto } from "./dto/login-gps-user.dto";
import { SubmitGpsPicksDto } from "./dto/submit-gps-picks.dto";
import { GpsAuthService } from "./gps-auth.service";
import { GpsDataService } from "./gps-data.service";

@Controller("gps")
export class GpsController {
  constructor(
    private readonly gpsAuthService: GpsAuthService,
    private readonly gpsDataService: GpsDataService
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post("auth/login")
  login(@Body() dto: LoginGpsUserDto) {
    return this.gpsAuthService.login(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post("auth/login-password")
  loginByPassword(@Body() dto: LoginGpsPasswordDto) {
    return this.gpsAuthService.loginByPassword(dto.password);
  }

  @HttpCode(HttpStatus.OK)
  @Post("auth/logout")
  async logout(@Headers("authorization") authorization: string | undefined) {
    const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : undefined;
    if (token) await this.gpsAuthService.logout(token);
    return { ok: true };
  }

  @HttpCode(HttpStatus.OK)
  @Post("auth/me")
  async me(@Headers("authorization") authorization: string | undefined) {
    return this.gpsAuthService.requireUser(authorization);
  }

  // Las 4 pestañas (Martín/Ana/Juan/Pedro) -- fijas en el backend, no
  // dependen de quien este logueado.
  @Get("personas")
  async listPersonas(@Headers("authorization") authorization: string | undefined) {
    await this.gpsAuthService.requireRole(authorization, "admin", "repartidor");
    return this.gpsDataService.listPersonas();
  }

  @Get("clients")
  async listClients(@Headers("authorization") authorization: string | undefined, @Query("persona") persona?: string) {
    const user = await this.gpsAuthService.requireRole(authorization, "admin", "repartidor");
    if (user.role === "repartidor" && !persona) {
      throw new BadRequestException("Falta indicar la pestaña (persona).");
    }
    return this.gpsDataService.listClients(persona);
  }

  @Get("picks/me")
  async getMyPicks(
    @Headers("authorization") authorization: string | undefined,
    @Query("persona") persona: string,
    @Query("day") day?: string
  ) {
    await this.gpsAuthService.requireRole(authorization, "repartidor");
    if (!persona) throw new BadRequestException("Falta indicar la pestaña (persona).");
    return { clientIds: await this.gpsDataService.getMyPicks(persona, day) };
  }

  @HttpCode(HttpStatus.OK)
  @Post("picks")
  async submitPicks(@Headers("authorization") authorization: string | undefined, @Body() dto: SubmitGpsPicksDto) {
    await this.gpsAuthService.requireRole(authorization, "repartidor");
    return this.gpsDataService.submitPicks(dto.persona, dto.clientIds, dto.day);
  }

  @HttpCode(HttpStatus.OK)
  @Delete("picks")
  async resetPicks(
    @Headers("authorization") authorization: string | undefined,
    @Query("persona") persona: string,
    @Query("day") day?: string
  ) {
    await this.gpsAuthService.requireRole(authorization, "repartidor");
    if (!persona) throw new BadRequestException("Falta indicar la pestaña (persona).");
    await this.gpsDataService.resetPicks(persona, day);
    return { ok: true };
  }

  @HttpCode(HttpStatus.OK)
  @Delete("picks/all")
  async resetAllPicks(@Headers("authorization") authorization: string | undefined, @Query("day") day?: string) {
    // Pedido explicito (demo): cualquier rol logueado puede reiniciar las
    // rutas de las 4 pestañas, no solo el admin.
    await this.gpsAuthService.requireRole(authorization, "admin", "repartidor");
    await this.gpsDataService.resetAllPicks(day);
    return { ok: true };
  }

  @Get("picks/status")
  async getStatus(@Headers("authorization") authorization: string | undefined, @Query("day") day?: string) {
    await this.gpsAuthService.requireRole(authorization, "admin", "repartidor");
    return this.gpsDataService.getStatus(day);
  }

  @Get("picks/final")
  async getFinalRoute(@Headers("authorization") authorization: string | undefined, @Query("day") day?: string) {
    await this.gpsAuthService.requireRole(authorization, "admin", "repartidor");
    return this.gpsDataService.getFinalRoute(day);
  }
}
