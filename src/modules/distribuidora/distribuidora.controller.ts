import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query
} from "@nestjs/common";
import { CreateDistribuidoraClientDto } from "./dto/create-distribuidora-client.dto";
import { CreateDistribuidoraOrderDto } from "./dto/create-distribuidora-order.dto";
import { CreateDistribuidoraProductDto } from "./dto/create-distribuidora-product.dto";
import { LoginDistribuidoraUserDto } from "./dto/login-distribuidora-user.dto";
import { UpdateDistribuidoraClientDto } from "./dto/update-distribuidora-client.dto";
import { UpdateDistribuidoraCommissionDto } from "./dto/update-distribuidora-commission.dto";
import { UpdateDistribuidoraOrderDto } from "./dto/update-distribuidora-order.dto";
import { UpdateDistribuidoraProductDto } from "./dto/update-distribuidora-product.dto";
import { DistribuidoraAuthService, extractBearerToken } from "./distribuidora-auth.service";
import { DistribuidoraService } from "./distribuidora.service";
import { DistribuidoraAuditContext, DistribuidoraOrderStatus, ORDER_STATUSES } from "./distribuidora.types";

// Para la auditoria interna: desde que dispositivo se hizo cada cambio.
// El id lo genera el navegador y viaja en X-Device-Id solo en las
// operaciones que modifican algo.
function auditContext(deviceId?: string, userAgent?: string): DistribuidoraAuditContext {
  return {
    deviceId: deviceId && /^[A-Za-z0-9-]{8,40}$/.test(deviceId) ? deviceId : undefined,
    userAgent
  };
}

// Login real desde 02/11/2026 (antes "sin login por ahora"): todo
// endpoint que no sea de auth exige una sesion valida. Facturar, y dar
// de alta/editar/eliminar productos y clientes, son solo para admin
// (Matias); un vendedor (Valentina) puede armar y mandar pedidos, ver
// pendientes/ventas y el catalogo, pero no facturar ni tocar el catalogo.
@Controller("distribuidora")
export class DistribuidoraController {
  constructor(
    private readonly distribuidoraService: DistribuidoraService,
    private readonly distribuidoraAuthService: DistribuidoraAuthService
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post("auth/login")
  login(@Body() dto: LoginDistribuidoraUserDto) {
    return this.distribuidoraAuthService.login(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post("auth/me")
  async me(@Headers("authorization") authorization: string | undefined) {
    return { user: await this.distribuidoraAuthService.requireUser(authorization) };
  }

  @HttpCode(HttpStatus.OK)
  @Post("auth/logout")
  async logout(@Headers("authorization") authorization: string | undefined) {
    const token = extractBearerToken(authorization);
    if (token) await this.distribuidoraAuthService.logout(token);
    return { ok: true };
  }

  // Pestaña Comisión del admin: cuanto se le paga a cada vendedor. Las
  // ventas en si se calculan en el frontend con /orders (ya trae
  // soldBy); esto es solo la lista de usuarios y su porcentaje.
  @Get("users")
  async listUsers(@Headers("authorization") authorization: string | undefined) {
    const user = await this.distribuidoraAuthService.requireUser(authorization);
    this.distribuidoraAuthService.requireAdmin(user);
    return this.distribuidoraAuthService.listUsers();
  }

  @Patch("users/:id/commission")
  async updateCommission(
    @Headers("authorization") authorization: string | undefined,
    @Param("id", ParseIntPipe) userId: number,
    @Body() dto: UpdateDistribuidoraCommissionDto
  ) {
    const user = await this.distribuidoraAuthService.requireUser(authorization);
    this.distribuidoraAuthService.requireAdmin(user);
    return this.distribuidoraAuthService.updateCommissionPercent(userId, dto.percent);
  }

  @Get("clients")
  async listClients(@Headers("authorization") authorization: string | undefined, @Query("q") search?: string) {
    await this.distribuidoraAuthService.requireUser(authorization);
    return this.distribuidoraService.listClients(search);
  }

  @Post("clients")
  async createClient(
    @Headers("authorization") authorization: string | undefined,
    @Body() dto: CreateDistribuidoraClientDto,
    @Headers("x-device-id") deviceId?: string,
    @Headers("user-agent") userAgent?: string
  ) {
    // 10/11/2026: la vendedora tambien puede AGREGAR clientes (no editarlos).
    await this.distribuidoraAuthService.requireUser(authorization);
    return this.distribuidoraService.createClient(dto, auditContext(deviceId, userAgent));
  }

  @Patch("clients/:id")
  async updateClient(
    @Headers("authorization") authorization: string | undefined,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateDistribuidoraClientDto,
    @Headers("x-device-id") deviceId?: string,
    @Headers("user-agent") userAgent?: string
  ) {
    const user = await this.distribuidoraAuthService.requireUser(authorization);
    this.distribuidoraAuthService.requireAdmin(user);
    return this.distribuidoraService.updateClient(id, dto, auditContext(deviceId, userAgent));
  }

  @Get("products")
  async listProducts(
    @Headers("authorization") authorization: string | undefined,
    @Query("q") search?: string,
    @Query("all") all?: string
  ) {
    await this.distribuidoraAuthService.requireUser(authorization);
    return this.distribuidoraService.listProducts(search, all === "1");
  }

  @Post("products")
  async createProduct(
    @Headers("authorization") authorization: string | undefined,
    @Body() dto: CreateDistribuidoraProductDto,
    @Headers("x-device-id") deviceId?: string,
    @Headers("user-agent") userAgent?: string
  ) {
    const user = await this.distribuidoraAuthService.requireUser(authorization);
    this.distribuidoraAuthService.requireAdmin(user);
    return this.distribuidoraService.createProduct(dto, auditContext(deviceId, userAgent));
  }

  @Patch("products/:id")
  async updateProduct(
    @Headers("authorization") authorization: string | undefined,
    @Param("id", ParseIntPipe) productId: number,
    @Body() dto: UpdateDistribuidoraProductDto,
    @Headers("x-device-id") deviceId?: string,
    @Headers("user-agent") userAgent?: string
  ) {
    const user = await this.distribuidoraAuthService.requireUser(authorization);
    this.distribuidoraAuthService.requireAdmin(user);
    return this.distribuidoraService.updateProduct(productId, dto, auditContext(deviceId, userAgent));
  }

  @Delete("products/:id")
  @HttpCode(204)
  async deleteProduct(
    @Headers("authorization") authorization: string | undefined,
    @Param("id", ParseIntPipe) productId: number,
    @Headers("x-device-id") deviceId?: string,
    @Headers("user-agent") userAgent?: string
  ) {
    const user = await this.distribuidoraAuthService.requireUser(authorization);
    this.distribuidoraAuthService.requireAdmin(user);
    await this.distribuidoraService.deleteProduct(productId, auditContext(deviceId, userAgent));
  }

  @Get("orders")
  async listOrders(@Headers("authorization") authorization: string | undefined, @Query("status") status?: string) {
    await this.distribuidoraAuthService.requireUser(authorization);
    if (status && !(ORDER_STATUSES as readonly string[]).includes(status)) {
      throw new BadRequestException("status tiene que ser pendiente o facturado");
    }
    return this.distribuidoraService.listOrders(status as DistribuidoraOrderStatus | undefined);
  }

  @Get("orders/:id")
  async getOrder(@Headers("authorization") authorization: string | undefined, @Param("id", ParseIntPipe) orderId: number) {
    await this.distribuidoraAuthService.requireUser(authorization);
    return this.distribuidoraService.getOrder(orderId);
  }

  @Post("orders")
  async createOrder(
    @Headers("authorization") authorization: string | undefined,
    @Body() dto: CreateDistribuidoraOrderDto,
    @Headers("x-device-id") deviceId?: string,
    @Headers("user-agent") userAgent?: string
  ) {
    const user = await this.distribuidoraAuthService.requireUser(authorization);
    return this.distribuidoraService.createOrder(dto, user.fullName ?? user.username, auditContext(deviceId, userAgent));
  }

  @Patch("orders/:id")
  async updateOrder(
    @Headers("authorization") authorization: string | undefined,
    @Param("id", ParseIntPipe) orderId: number,
    @Body() dto: UpdateDistribuidoraOrderDto,
    @Headers("x-device-id") deviceId?: string,
    @Headers("user-agent") userAgent?: string
  ) {
    const user = await this.distribuidoraAuthService.requireUser(authorization);
    return this.distribuidoraService.updateOrder(orderId, dto, user.fullName ?? user.username, auditContext(deviceId, userAgent));
  }

  @Delete("orders/:id")
  @HttpCode(204)
  async deleteOrder(
    @Headers("authorization") authorization: string | undefined,
    @Param("id", ParseIntPipe) orderId: number,
    @Query("boleta") boleta?: string,
    @Headers("x-device-id") deviceId?: string,
    @Headers("user-agent") userAgent?: string
  ) {
    const user = await this.distribuidoraAuthService.requireUser(authorization);
    // ?boleta=1 = "se que tiene boleta, borrala igual".
    await this.distribuidoraService.deleteOrder(orderId, boleta === "1", user.fullName ?? user.username, auditContext(deviceId, userAgent));
  }

  @Patch("orders/:id/invoice")
  async invoiceOrder(
    @Headers("authorization") authorization: string | undefined,
    @Param("id", ParseIntPipe) orderId: number,
    @Headers("x-device-id") deviceId?: string,
    @Headers("user-agent") userAgent?: string
  ) {
    const user = await this.distribuidoraAuthService.requireUser(authorization);
    this.distribuidoraAuthService.requireAdmin(user);
    return this.distribuidoraService.invoiceOrder(orderId, user.fullName ?? user.username, auditContext(deviceId, userAgent));
  }
}
