import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query
} from "@nestjs/common";
import { CreateDistribuidoraClientDto } from "./dto/create-distribuidora-client.dto";
import { CreateDistribuidoraOrderDto } from "./dto/create-distribuidora-order.dto";
import { CreateDistribuidoraProductDto } from "./dto/create-distribuidora-product.dto";
import { UpdateDistribuidoraOrderDto } from "./dto/update-distribuidora-order.dto";
import { UpdateDistribuidoraProductDto } from "./dto/update-distribuidora-product.dto";
import { DistribuidoraService } from "./distribuidora.service";
import { DistribuidoraAuditContext, DistribuidoraOrderStatus, ORDER_STATUSES } from "./distribuidora.types";

// Para la auditoria interna: desde que dispositivo se hizo cada cambio.
// El id lo genera el navegador (no hay login) y viaja en X-Device-Id solo
// en las operaciones que modifican algo.
function auditContext(deviceId?: string, userAgent?: string): DistribuidoraAuditContext {
  return {
    deviceId: deviceId && /^[A-Za-z0-9-]{8,40}$/.test(deviceId) ? deviceId : undefined,
    userAgent
  };
}

// Sin login por ahora (08/10/2026, pedido explicito: "capaz que hacemos
// un usuario solo, despues vemos como dividirlo"). El vendedor de la
// calle y la oficina usan los mismos endpoints -- lo que cambia es la
// pantalla del frontend. Cuando se separen los usuarios, los de oficina
// (facturar, altas) son los que hay que proteger.
@Controller("distribuidora")
export class DistribuidoraController {
  constructor(private readonly distribuidoraService: DistribuidoraService) {}

  @Get("clients")
  listClients(@Query("q") search?: string) {
    return this.distribuidoraService.listClients(search);
  }

  @Post("clients")
  createClient(
    @Body() dto: CreateDistribuidoraClientDto,
    @Headers("x-device-id") deviceId?: string,
    @Headers("user-agent") userAgent?: string
  ) {
    return this.distribuidoraService.createClient(dto, auditContext(deviceId, userAgent));
  }

  @Get("products")
  listProducts(@Query("q") search?: string, @Query("all") all?: string) {
    return this.distribuidoraService.listProducts(search, all === "1");
  }

  @Post("products")
  createProduct(
    @Body() dto: CreateDistribuidoraProductDto,
    @Headers("x-device-id") deviceId?: string,
    @Headers("user-agent") userAgent?: string
  ) {
    return this.distribuidoraService.createProduct(dto, auditContext(deviceId, userAgent));
  }

  @Patch("products/:id")
  updateProduct(
    @Param("id", ParseIntPipe) productId: number,
    @Body() dto: UpdateDistribuidoraProductDto,
    @Headers("x-device-id") deviceId?: string,
    @Headers("user-agent") userAgent?: string
  ) {
    return this.distribuidoraService.updateProduct(productId, dto, auditContext(deviceId, userAgent));
  }

  @Get("orders")
  listOrders(@Query("status") status?: string) {
    if (status && !(ORDER_STATUSES as readonly string[]).includes(status)) {
      throw new BadRequestException("status tiene que ser pendiente o facturado");
    }
    return this.distribuidoraService.listOrders(status as DistribuidoraOrderStatus | undefined);
  }

  @Get("orders/:id")
  getOrder(@Param("id", ParseIntPipe) orderId: number) {
    return this.distribuidoraService.getOrder(orderId);
  }

  @Post("orders")
  createOrder(
    @Body() dto: CreateDistribuidoraOrderDto,
    @Headers("x-device-id") deviceId?: string,
    @Headers("user-agent") userAgent?: string
  ) {
    return this.distribuidoraService.createOrder(dto, auditContext(deviceId, userAgent));
  }

  @Patch("orders/:id")
  updateOrder(
    @Param("id", ParseIntPipe) orderId: number,
    @Body() dto: UpdateDistribuidoraOrderDto,
    @Headers("x-device-id") deviceId?: string,
    @Headers("user-agent") userAgent?: string
  ) {
    return this.distribuidoraService.updateOrder(orderId, dto, auditContext(deviceId, userAgent));
  }

  @Delete("orders/:id")
  @HttpCode(204)
  async deleteOrder(
    @Param("id", ParseIntPipe) orderId: number,
    @Query("boleta") boleta?: string,
    @Headers("x-device-id") deviceId?: string,
    @Headers("user-agent") userAgent?: string
  ) {
    // ?boleta=1 = "se que tiene boleta, borrala igual".
    await this.distribuidoraService.deleteOrder(orderId, boleta === "1", auditContext(deviceId, userAgent));
  }

  @Patch("orders/:id/invoice")
  invoiceOrder(
    @Param("id", ParseIntPipe) orderId: number,
    @Headers("x-device-id") deviceId?: string,
    @Headers("user-agent") userAgent?: string
  ) {
    return this.distribuidoraService.invoiceOrder(orderId, auditContext(deviceId, userAgent));
  }
}
