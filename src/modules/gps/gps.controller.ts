import { Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, Post, Query } from "@nestjs/common";
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

  @Get("clients")
  async listClients(@Headers("authorization") authorization: string | undefined) {
    const user = await this.gpsAuthService.requireRole(authorization, "admin", "repartidor");
    return this.gpsDataService.listClients(user.role === "repartidor" ? user.username : undefined);
  }

  @Get("picks/me")
  async getMyPicks(@Headers("authorization") authorization: string | undefined, @Query("day") day?: string) {
    const user = await this.gpsAuthService.requireRole(authorization, "repartidor");
    return { clientIds: await this.gpsDataService.getMyPicks(user.username, day) };
  }

  @HttpCode(HttpStatus.OK)
  @Post("picks")
  async submitPicks(@Headers("authorization") authorization: string | undefined, @Body() dto: SubmitGpsPicksDto) {
    const user = await this.gpsAuthService.requireRole(authorization, "repartidor");
    return this.gpsDataService.submitPicks(user.username, dto.clientIds, dto.day);
  }

  @HttpCode(HttpStatus.OK)
  @Delete("picks")
  async resetPicks(@Headers("authorization") authorization: string | undefined, @Query("day") day?: string) {
    const user = await this.gpsAuthService.requireRole(authorization, "repartidor");
    await this.gpsDataService.resetPicks(user.username, day);
    return { ok: true };
  }

  @HttpCode(HttpStatus.OK)
  @Delete("picks/all")
  async resetAllPicks(@Headers("authorization") authorization: string | undefined, @Query("day") day?: string) {
    await this.gpsAuthService.requireRole(authorization, "admin");
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
