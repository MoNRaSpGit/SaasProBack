import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CreateOriolClientDto } from "./dto/create-oriol-client.dto";
import { CreateOriolPaymentDto } from "./dto/create-oriol-payment.dto";
import { CreateOriolProductDto } from "./dto/create-oriol-product.dto";
import { CreateOriolSaleContadoDto } from "./dto/create-oriol-sale-contado.dto";
import { CreateOriolSaleCreditoDto } from "./dto/create-oriol-sale-credito.dto";
import { UpdateOriolConfigDto } from "./dto/update-oriol-config.dto";
import { UpdateOriolProductDto } from "./dto/update-oriol-product.dto";
import { UpdateOriolSaleDto } from "./dto/update-oriol-sale.dto";
import { UpdateOriolStockDto } from "./dto/update-oriol-stock.dto";
import { OriolApiKeyGuard } from "./oriol-api-key.guard";
import { OriolService } from "./oriol.service";

@Controller("oriol")
@UseGuards(OriolApiKeyGuard)
export class OriolController {
  constructor(private readonly oriolService: OriolService) {}

  @Get("productos")
  listProducts() {
    return this.oriolService.listProducts();
  }

  @Get("productos/buscar")
  searchProducts(@Query("q") query?: string) {
    return this.oriolService.searchProducts(query ?? "");
  }

  @Get("productos/codigo/:codigoBarra")
  getProductByBarcode(@Param("codigoBarra") codigoBarra: string) {
    return this.oriolService.getProductByBarcode(codigoBarra);
  }

  @Get("productos/:id")
  getProduct(@Param("id", ParseIntPipe) productId: number) {
    return this.oriolService.getProduct(productId);
  }

  @Post("productos")
  createProduct(@Body() dto: CreateOriolProductDto) {
    return this.oriolService.createProduct(dto);
  }

  @Patch("productos/:id")
  updateProduct(@Param("id", ParseIntPipe) productId: number, @Body() dto: UpdateOriolProductDto) {
    return this.oriolService.updateProduct(productId, dto);
  }

  @Patch("productos/:id/stock")
  updateStock(@Param("id", ParseIntPipe) productId: number, @Body() dto: UpdateOriolStockDto) {
    return this.oriolService.updateStock(productId, dto);
  }

  @Delete("productos/:id")
  deleteProduct(@Param("id", ParseIntPipe) productId: number) {
    return this.oriolService.deleteProduct(productId);
  }

  @Post("ventas/contado")
  createSaleContado(@Body() dto: CreateOriolSaleContadoDto) {
    return this.oriolService.createSaleContado(dto);
  }

  @Post("ventas/credito")
  createSaleCredito(@Body() dto: CreateOriolSaleCreditoDto) {
    return this.oriolService.createSaleCredito(dto);
  }

  @Patch("ventas/:id")
  updateSale(@Param("id", ParseIntPipe) saleId: number, @Body() dto: UpdateOriolSaleDto) {
    return this.oriolService.updateSale(saleId, dto);
  }

  @Get("clientes")
  listClients() {
    return this.oriolService.listClients();
  }

  @Get("clientes/:id")
  getClient(@Param("id", ParseIntPipe) clientId: number) {
    return this.oriolService.getClient(clientId);
  }

  @Post("clientes")
  createClient(@Body() dto: CreateOriolClientDto) {
    return this.oriolService.createClient(dto);
  }

  @Get("clientes/:id/historial")
  getClientHistory(@Param("id", ParseIntPipe) clientId: number) {
    return this.oriolService.getClientHistory(clientId);
  }

  @Get("pagos")
  listPayments() {
    return this.oriolService.listPayments();
  }

  @Post("pagos")
  createPayment(@Body() dto: CreateOriolPaymentDto) {
    return this.oriolService.createPayment(dto);
  }

  @Get("config")
  getConfig() {
    return this.oriolService.getConfig();
  }

  @Patch("config")
  updateConfig(@Body() dto: UpdateOriolConfigDto) {
    return this.oriolService.updateConfig(dto);
  }

  @Get("panel/hoy")
  getPanelHoy() {
    return this.oriolService.getPanelHoy();
  }

  @Get("panel/mes/:anio/:mes")
  getMonthSummary(@Param("anio", ParseIntPipe) anio: number, @Param("mes", ParseIntPipe) mes: number) {
    return this.oriolService.getMonthSummary(anio, mes);
  }

  @Get("panel/historial-meses")
  getMonthHistory(@Query("cantidad") cantidad?: string) {
    return this.oriolService.getMonthHistory(cantidad ? Number(cantidad) : 6);
  }
}
