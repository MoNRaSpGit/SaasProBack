import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { CreateDistribuidoraClientDto } from "./dto/create-distribuidora-client.dto";
import { CreateDistribuidoraOrderDto } from "./dto/create-distribuidora-order.dto";
import { CreateDistribuidoraProductDto } from "./dto/create-distribuidora-product.dto";
import { UpdateDistribuidoraProductDto } from "./dto/update-distribuidora-product.dto";
import { DistribuidoraService } from "./distribuidora.service";
import { DistribuidoraOrderStatus, ORDER_STATUSES } from "./distribuidora.types";

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
  createClient(@Body() dto: CreateDistribuidoraClientDto) {
    return this.distribuidoraService.createClient(dto);
  }

  @Get("products")
  listProducts(@Query("q") search?: string, @Query("all") all?: string) {
    return this.distribuidoraService.listProducts(search, all === "1");
  }

  @Post("products")
  createProduct(@Body() dto: CreateDistribuidoraProductDto) {
    return this.distribuidoraService.createProduct(dto);
  }

  @Patch("products/:id")
  updateProduct(@Param("id", ParseIntPipe) productId: number, @Body() dto: UpdateDistribuidoraProductDto) {
    return this.distribuidoraService.updateProduct(productId, dto);
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
  createOrder(@Body() dto: CreateDistribuidoraOrderDto) {
    return this.distribuidoraService.createOrder(dto);
  }

  @Patch("orders/:id/invoice")
  invoiceOrder(@Param("id", ParseIntPipe) orderId: number) {
    return this.distribuidoraService.invoiceOrder(orderId);
  }
}
