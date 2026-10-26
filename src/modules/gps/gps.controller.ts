import { BadRequestException, Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, Post, Query } from "@nestjs/common";
import { AssignGpsClientsDto } from "./dto/assign-gps-clients.dto";
import { ComputeGpsRouteDto } from "./dto/compute-gps-route.dto";
import { CreateGpsClientDto, GeocodeGpsAddressDto } from "./dto/create-gps-client.dto";
import { LoginGpsPasswordDto } from "./dto/login-gps-password.dto";
import { LoginGpsUserDto } from "./dto/login-gps-user.dto";
import { SaveGpsFinalOrderDto } from "./dto/save-gps-final-order.dto";
import { SubmitGpsPicksDto } from "./dto/submit-gps-picks.dto";
import { GpsAuthService } from "./gps-auth.service";
import { GpsDataService } from "./gps-data.service";
import { GpsGeocodingService } from "./gps-geocoding.service";
import { GpsRoutingService } from "./gps-routing.service";

@Controller("gps")
export class GpsController {
  constructor(
    private readonly gpsAuthService: GpsAuthService,
    private readonly gpsDataService: GpsDataService,
    private readonly gpsRoutingService: GpsRoutingService,
    private readonly gpsGeocodingService: GpsGeocodingService
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

  // Pestaña "Clientes": todos los clientes con su repartidor asignado.
  @Get("clients/assignments")
  async listAssignments(@Headers("authorization") authorization: string | undefined) {
    await this.gpsAuthService.requireRole(authorization, "admin", "repartidor");
    return this.gpsDataService.listAssignments();
  }

  // "Agregar cliente" a mano (27/10/2026, pedido explicito): primero se
  // busca la direccion en el mapa (geocodificador IDE, no gasta cupo de
  // rutas) y, confirmada, se guarda el cliente sin asignar.
  @HttpCode(HttpStatus.OK)
  @Post("clients/geocode")
  async geocodeAddress(@Headers("authorization") authorization: string | undefined, @Body() dto: GeocodeGpsAddressDto) {
    await this.gpsAuthService.requireRole(authorization, "admin", "repartidor");
    return this.gpsGeocodingService.geocode(dto.address);
  }

  @Post("clients")
  async createClient(@Headers("authorization") authorization: string | undefined, @Body() dto: CreateGpsClientDto) {
    await this.gpsAuthService.requireRole(authorization, "admin", "repartidor");
    return this.gpsDataService.createClient(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post("clients/assign")
  async assignClients(@Headers("authorization") authorization: string | undefined, @Body() dto: AssignGpsClientsDto) {
    await this.gpsAuthService.requireRole(authorization, "admin", "repartidor");
    return this.gpsDataService.assignClients(dto.clientIds, dto.persona ?? null);
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

  // Ruta optima real (22/10/2026): orden de visita + recorrido por calles
  // para esos clientes. Cuenta llamadas y corta al 90% del limite diario.
  @HttpCode(HttpStatus.OK)
  @Post("route")
  async computeRoute(@Headers("authorization") authorization: string | undefined, @Body() dto: ComputeGpsRouteDto) {
    await this.gpsAuthService.requireRole(authorization, "admin", "repartidor");
    return this.gpsRoutingService.computeRoute(dto.clientIds, dto.keepOrder ?? false);
  }

  // Consumo del servicio de rutas, para el panel del admin.
  @Get("usage")
  async getUsage(@Headers("authorization") authorization: string | undefined) {
    await this.gpsAuthService.requireRole(authorization, "admin");
    return this.gpsRoutingService.getUsage();
  }

  // Genera la ruta final con lo que ya guardaron (aunque falten), la deja
  // guardada y reinicia las rutas de todos (pedido explicito 22/10/2026).
  @HttpCode(HttpStatus.OK)
  @Post("final/generate")
  async generateFinalRoute(@Headers("authorization") authorization: string | undefined) {
    await this.gpsAuthService.requireRole(authorization, "admin", "repartidor");
    return this.gpsDataService.generateFinalRoute();
  }

  // Orden de visita editado a mano (23/10/2026): p.ej. pasar al final a
  // un cliente que todavia no abrio. Queda guardado en la ruta final.
  @HttpCode(HttpStatus.OK)
  @Post("final/order")
  async saveFinalRouteOrder(@Headers("authorization") authorization: string | undefined, @Body() dto: SaveGpsFinalOrderDto) {
    await this.gpsAuthService.requireRole(authorization, "admin", "repartidor");
    return this.gpsDataService.saveFinalRouteOrder(dto.routeId, dto.clientIds);
  }

  // La ultima ruta final generada, para volver a verla.
  @Get("final/last")
  async getLastFinalRoute(@Headers("authorization") authorization: string | undefined) {
    await this.gpsAuthService.requireRole(authorization, "admin", "repartidor");
    return { route: await this.gpsDataService.getLastGeneratedFinalRoute() };
  }

  @Get("picks/final")
  async getFinalRoute(@Headers("authorization") authorization: string | undefined, @Query("day") day?: string) {
    await this.gpsAuthService.requireRole(authorization, "admin", "repartidor");
    return this.gpsDataService.getFinalRoute(day);
  }
}
