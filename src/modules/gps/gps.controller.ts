import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { CreateGpsSaleDto } from "./dto/create-gps-sale.dto";
import { LoginGpsUserDto } from "./dto/login-gps-user.dto";
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
    await this.gpsAuthService.requireRole(authorization, "admin", "vendedor", "repartidor");
    return this.gpsDataService.listClients();
  }

  @Get("products")
  async listProducts(@Headers("authorization") authorization: string | undefined) {
    await this.gpsAuthService.requireRole(authorization, "admin", "vendedor", "repartidor");
    return this.gpsDataService.listProducts();
  }

  @HttpCode(HttpStatus.CREATED)
  @Post("sales")
  async createSale(@Headers("authorization") authorization: string | undefined, @Body() dto: CreateGpsSaleDto) {
    const user = await this.gpsAuthService.requireRole(authorization, "vendedor");
    return this.gpsDataService.createSale(dto, user.username);
  }

  @Get("sales/pending")
  async listPendingSales(@Headers("authorization") authorization: string | undefined) {
    await this.gpsAuthService.requireRole(authorization, "admin", "repartidor");
    return this.gpsDataService.listPendingSales();
  }

  @HttpCode(HttpStatus.OK)
  @Post("sales/:id/deliver")
  async markDelivered(@Headers("authorization") authorization: string | undefined, @Param("id") id: string) {
    await this.gpsAuthService.requireRole(authorization, "repartidor");
    await this.gpsDataService.markDelivered(Number(id));
    return { ok: true };
  }
}
