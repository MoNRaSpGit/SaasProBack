import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { CreateOriolClientDto } from "./dto/create-oriol-client.dto";
import { CreateOriolCreditPaymentDto } from "./dto/create-oriol-credit-payment.dto";
import { CreateOriolPaymentDto } from "./dto/create-oriol-payment.dto";
import { CreateOriolProductDto } from "./dto/create-oriol-product.dto";
import { CreateOriolSaleContadoDto } from "./dto/create-oriol-sale-contado.dto";
import { CreateOriolSaleCreditoDto } from "./dto/create-oriol-sale-credito.dto";
import { UpdateOriolCierreDiaDto } from "./dto/update-oriol-cierre-dia.dto";
import { UpdateOriolConfigDto } from "./dto/update-oriol-config.dto";
import { UpdateOriolProductDto } from "./dto/update-oriol-product.dto";
import { UpdateOriolSaleDto } from "./dto/update-oriol-sale.dto";
import { UpdateOriolStockDto } from "./dto/update-oriol-stock.dto";
import { UpdateOriolTasaDolarDto } from "./dto/update-oriol-tasa-dolar.dto";
import { OriolClientsService } from "./oriol-clients.service";
import { OriolConfigService } from "./oriol-config.service";
import { OriolPanelService } from "./oriol-panel.service";
import { OriolPaymentsService } from "./oriol-payments.service";
import { OriolProductsService } from "./oriol-products.service";
import { OriolSalesService } from "./oriol-sales.service";

// Sin proteccion por ahora (a pedido explicito): cualquiera que entre a
// la app puede ver y editar todo, igual que carnet/joker/piloto. Si mas
// adelante hace falta, se puede volver a agregar un guard aca.
@Controller("oriol")
export class OriolController {
  constructor(
    private readonly productsService: OriolProductsService,
    private readonly salesService: OriolSalesService,
    private readonly clientsService: OriolClientsService,
    private readonly paymentsService: OriolPaymentsService,
    private readonly configService: OriolConfigService,
    private readonly panelService: OriolPanelService
  ) {}

  @Get("productos")
  listProducts() {
    return this.productsService.listProducts();
  }

  @Get("productos/buscar")
  searchProducts(@Query("q") query?: string) {
    return this.productsService.searchProducts(query ?? "");
  }

  @Get("productos/codigo/:codigoBarra")
  getProductByBarcode(@Param("codigoBarra") codigoBarra: string) {
    return this.productsService.getProductByBarcode(codigoBarra);
  }

  @Get("productos/:id")
  getProduct(@Param("id", ParseIntPipe) productId: number) {
    return this.productsService.getProduct(productId);
  }

  @Post("productos")
  createProduct(@Body() dto: CreateOriolProductDto) {
    return this.productsService.createProduct(dto);
  }

  @Patch("productos/:id")
  updateProduct(@Param("id", ParseIntPipe) productId: number, @Body() dto: UpdateOriolProductDto) {
    return this.productsService.updateProduct(productId, dto);
  }

  @Patch("productos/:id/stock")
  updateStock(@Param("id", ParseIntPipe) productId: number, @Body() dto: UpdateOriolStockDto) {
    return this.productsService.updateStock(productId, dto);
  }

  @Delete("productos/:id")
  deleteProduct(@Param("id", ParseIntPipe) productId: number) {
    return this.productsService.deleteProduct(productId);
  }

  @Post("ventas/contado")
  createSaleContado(@Body() dto: CreateOriolSaleContadoDto) {
    return this.salesService.createSaleContado(dto);
  }

  @Post("ventas/credito")
  createSaleCredito(@Body() dto: CreateOriolSaleCreditoDto) {
    return this.salesService.createSaleCredito(dto);
  }

  @Patch("ventas/:id")
  updateSale(@Param("id", ParseIntPipe) saleId: number, @Body() dto: UpdateOriolSaleDto) {
    return this.salesService.updateSale(saleId, dto);
  }

  @Post("ventas/:id/pagos-credito")
  pagarVentaCredito(@Param("id", ParseIntPipe) saleId: number, @Body() dto: CreateOriolCreditPaymentDto) {
    return this.salesService.pagarVentaCredito(saleId, dto);
  }

  @Get("clientes")
  listClients() {
    return this.clientsService.listClients();
  }

  @Get("clientes/:id")
  getClient(@Param("id", ParseIntPipe) clientId: number) {
    return this.clientsService.getClient(clientId);
  }

  @Post("clientes")
  createClient(@Body() dto: CreateOriolClientDto) {
    return this.clientsService.createClient(dto);
  }

  @Get("clientes/:id/historial")
  getClientHistory(@Param("id", ParseIntPipe) clientId: number) {
    return this.clientsService.getClientHistory(clientId);
  }

  @Get("pagos")
  listPayments() {
    return this.paymentsService.listPayments();
  }

  @Post("pagos")
  createPayment(@Body() dto: CreateOriolPaymentDto) {
    return this.paymentsService.createPayment(dto);
  }

  @Get("config")
  getConfig() {
    return this.configService.getConfig();
  }

  @Patch("panel/cambio")
  updateCambio(@Body() dto: UpdateOriolConfigDto) {
    return this.configService.updateCambio(dto);
  }

  @Patch("config/tasa-dolar")
  updateTasaDolar(@Body() dto: UpdateOriolTasaDolarDto) {
    return this.configService.updateTasaDolar(dto);
  }

  @Get("panel/hoy")
  getPanelHoy() {
    return this.panelService.getPanelHoy();
  }

  @Get("panel/mes/:anio/:mes")
  getMonthSummary(@Param("anio", ParseIntPipe) anio: number, @Param("mes", ParseIntPipe) mes: number) {
    return this.panelService.getMonthSummary(anio, mes);
  }

  @Get("panel/historial-meses")
  getMonthHistory(@Query("cantidad") cantidad?: string) {
    return this.panelService.getMonthHistory(cantidad ? Number(cantidad) : 6);
  }

  @Patch("cierres/:fecha")
  editarCierreDia(@Param("fecha") fecha: string, @Body() dto: UpdateOriolCierreDiaDto) {
    return this.panelService.editarCierreDia(fecha, dto);
  }
}
