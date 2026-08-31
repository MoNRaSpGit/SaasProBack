import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { BulkApplyJokerRecipeDto } from "./dto/bulk-apply-joker-recipe.dto";
import { CloseJokerRegisterDto } from "./dto/close-joker-register.dto";
import { CreateJokerAccountEntryDto } from "./dto/create-joker-account-entry.dto";
import { CreateJokerAccountPaymentDto } from "./dto/create-joker-account-payment.dto";
import { CreateJokerClientDto } from "./dto/create-joker-client.dto";
import { CreateJokerCourierCashMovementDto } from "./dto/create-joker-courier-cash-movement.dto";
import { CreateJokerOrderDto } from "./dto/create-joker-order.dto";
import { CreateJokerProductDto } from "./dto/create-joker-product.dto";
import { CreateJokerStockItemDto } from "./dto/create-joker-stock-item.dto";
import { ListJokerOrdersDto } from "./dto/list-joker-orders.dto";
import { LoginJokerDto } from "./dto/login-joker.dto";
import { OpenJokerUserRegisterDto } from "./dto/open-joker-user-register.dto";
import { RestockJokerStockItemDto } from "./dto/restock-joker-stock-item.dto";
import { SetJokerProductRecipeDto } from "./dto/set-joker-product-recipe.dto";
import { SettleJokerCourierDto } from "./dto/settle-joker-courier.dto";
import { SignQzRequestDto } from "./dto/sign-qz-request.dto";
import { UpdateJokerCierreDiaDto } from "./dto/update-joker-cierre-dia.dto";
import { UpdateJokerCourierDto } from "./dto/update-joker-courier.dto";
import { UpdateJokerOrderDto } from "./dto/update-joker-order.dto";
import { UpdateJokerProductDto } from "./dto/update-joker-product.dto";
import { UpdateJokerStockItemDto } from "./dto/update-joker-stock-item.dto";
import { JokerAccountService } from "./joker-account.service";
import { JokerAuthService } from "./joker-auth.service";
import { JokerCourierService } from "./joker-courier.service";
import { JokerOrdersService } from "./joker-orders.service";
import { JokerPrintingService } from "./joker-printing.service";
import { JokerProductsService } from "./joker-products.service";
import { JokerReportingService } from "./joker-reporting.service";
import { JokerStockService } from "./joker-stock.service";

@Controller("joker")
export class JokerController {
  constructor(
    private readonly productsService: JokerProductsService,
    private readonly stockService: JokerStockService,
    private readonly ordersService: JokerOrdersService,
    private readonly courierService: JokerCourierService,
    private readonly accountService: JokerAccountService,
    private readonly reportingService: JokerReportingService,
    private readonly printingService: JokerPrintingService,
    private readonly authService: JokerAuthService
  ) {}

  @Post("auth/login")
  login(@Body() dto: LoginJokerDto) {
    return this.authService.login(dto);
  }

  @Get("products")
  listProducts() {
    return this.productsService.listProducts();
  }

  @Post("products")
  createProduct(@Body() dto: CreateJokerProductDto) {
    return this.productsService.createProduct(dto);
  }

  @Patch("products/:id")
  updateProduct(@Param("id", ParseIntPipe) productId: number, @Body() dto: UpdateJokerProductDto) {
    return this.productsService.updateProduct(productId, dto);
  }

  @Delete("products/:id")
  deleteProduct(@Param("id", ParseIntPipe) productId: number) {
    return this.productsService.deleteProduct(productId);
  }

  @Get("products/:id/recipe")
  getProductRecipe(@Param("id", ParseIntPipe) productId: number) {
    return this.productsService.getProductRecipe(productId);
  }

  @Patch("products/:id/recipe")
  setProductRecipe(@Param("id", ParseIntPipe) productId: number, @Body() dto: SetJokerProductRecipeDto) {
    return this.productsService.setProductRecipe(productId, dto);
  }

  @Post("recipes/bulk-apply")
  bulkApplyRecipe(@Body() dto: BulkApplyJokerRecipeDto) {
    return this.productsService.bulkApplyRecipe(dto);
  }

  @Get("stock-items")
  listStockItems() {
    return this.stockService.listStockItems();
  }

  @Post("stock-items")
  createStockItem(@Body() dto: CreateJokerStockItemDto) {
    return this.stockService.createStockItem(dto);
  }

  @Post("stock-items/:id/restock")
  restockItem(@Param("id", ParseIntPipe) stockItemId: number, @Body() dto: RestockJokerStockItemDto) {
    return this.stockService.restockItem(stockItemId, dto);
  }

  @Patch("stock-items/:id")
  updateStockItemQuantity(@Param("id", ParseIntPipe) stockItemId: number, @Body() dto: UpdateJokerStockItemDto) {
    return this.stockService.updateStockItemQuantity(stockItemId, dto);
  }

  @Get("stock-items/:id/consumption")
  getStockItemConsumption(@Param("id", ParseIntPipe) stockItemId: number) {
    return this.stockService.getStockItemConsumption(stockItemId);
  }

  @Delete("stock-items/:id")
  deleteStockItem(@Param("id", ParseIntPipe) stockItemId: number) {
    return this.stockService.deleteStockItem(stockItemId);
  }

  @Post("orders")
  createOrder(@Body() dto: CreateJokerOrderDto) {
    return this.ordersService.createOrder(dto);
  }

  @Patch("orders/:id")
  updateOrder(@Param("id", ParseIntPipe) orderId: number, @Body() dto: UpdateJokerOrderDto) {
    return this.ordersService.updateOrder(orderId, dto);
  }

  @Get("orders")
  listOrders(@Query() query: ListJokerOrdersDto) {
    return this.ordersService.listOrders(query);
  }

  @Get("orders/current-period")
  listCurrentPeriodOrders(@Query("courierId") courierId?: string) {
    return this.ordersService.listCurrentPeriodOrders(courierId ? Number(courierId) : undefined);
  }

  @Get("orders/pending")
  listPendingOrders() {
    return this.ordersService.listPendingOrders();
  }

  @Post("orders/:id/accept")
  acceptOrder(@Param("id", ParseIntPipe) orderId: number) {
    return this.ordersService.acceptOrder(orderId);
  }

  @Post("orders/:id/reject")
  rejectOrder(@Param("id", ParseIntPipe) orderId: number) {
    return this.ordersService.rejectOrder(orderId);
  }

  @Delete("orders")
  deleteAllOrders() {
    return this.ordersService.deleteAllOrders();
  }

  @Get("couriers")
  listCouriers() {
    return this.courierService.listCouriers();
  }

  @Patch("couriers/:id")
  updateCourier(@Param("id", ParseIntPipe) courierId: number, @Body() dto: UpdateJokerCourierDto) {
    return this.courierService.updateCourier(courierId, dto);
  }

  @Post("couriers/:id/habilitar")
  enableCourier(@Param("id", ParseIntPipe) courierId: number) {
    return this.courierService.enableCourier(courierId);
  }

  @Post("couriers/:id/liquidar")
  settleCourier(@Param("id", ParseIntPipe) courierId: number, @Body() dto: SettleJokerCourierDto) {
    return this.courierService.settleCourier(courierId, dto);
  }

  @Get("couriers/:id/settlements")
  listCourierSettlements(@Param("id", ParseIntPipe) courierId: number) {
    return this.courierService.listCourierSettlements(courierId);
  }

  @Get("couriers/:id/cash-summary")
  getCourierCashSummary(@Param("id", ParseIntPipe) courierId: number) {
    return this.courierService.getCourierCashSummary(courierId);
  }

  @Post("couriers/:id/cash-movements")
  addCourierCashMovement(@Param("id", ParseIntPipe) courierId: number, @Body() dto: CreateJokerCourierCashMovementDto) {
    return this.courierService.addCourierCashMovement(courierId, dto);
  }

  @Get("clients")
  listClients() {
    return this.accountService.listClients();
  }

  @Post("clients")
  createClient(@Body() dto: CreateJokerClientDto) {
    return this.accountService.createClient(dto);
  }

  @Delete("clients/:id")
  deleteClient(@Param("id", ParseIntPipe) clientId: number) {
    return this.accountService.deleteClient(clientId);
  }

  @Get("account-entries")
  listAccountEntries() {
    return this.accountService.listAccountEntries();
  }

  @Post("account-entries")
  createAccountEntry(@Body() dto: CreateJokerAccountEntryDto) {
    return this.accountService.createAccountEntry(dto);
  }

  @Delete("account-entries/client/:clientId")
  settleAccount(@Param("clientId", ParseIntPipe) clientId: number) {
    return this.accountService.settleAccount(clientId);
  }

  // Pago parcial o total de cuenta corriente -- no borra boletas, ver
  // JokerAccountService#createAccountPayment.
  @Post("account-payments")
  createAccountPayment(@Body() dto: CreateJokerAccountPaymentDto) {
    return this.accountService.createAccountPayment(dto);
  }

  // Pagos abiertos de todos los clientes, para calcular "Debe $X" en el
  // listado (boletas abiertas menos pagos abiertos).
  @Get("account-payments")
  listOpenAccountPayments() {
    return this.accountService.listOpenAccountPayments();
  }

  // Historial completo (abiertos + ya cerrados) de pagos de un cliente
  // puntual.
  @Get("account-payments/client/:clientId")
  listAccountPaymentsForClient(@Param("clientId", ParseIntPipe) clientId: number) {
    return this.accountService.listAccountPaymentsForClient(clientId);
  }

  // Respaldo permanente de consumos ya pagados o de clientes eliminados,
  // para reclamos ("el cliente dice que no debia eso").
  @Get("account-settlements/client/:clientId")
  listAccountSettlements(@Param("clientId", ParseIntPipe) clientId: number) {
    return this.accountService.listAccountSettlements(clientId);
  }

  // QZ Tray pide el certificado como texto plano (no JSON) via
  // setCertificatePromise.
  @Get("qz-certificate")
  getQzCertificate(@Res() res: Response) {
    res.type("text/plain").send(this.printingService.getQzCertificate());
  }

  @Post("qz-sign")
  signQzRequest(@Body() dto: SignQzRequestDto) {
    return this.printingService.signQzRequest(dto.toSign);
  }

  @Get("register/state")
  getRegisterState() {
    return this.ordersService.getRegisterState();
  }

  @Post("register/open")
  openRegister() {
    return this.ordersService.openRegister();
  }

  @Post("register/close")
  closeRegister(@Body() dto: CloseJokerRegisterDto) {
    return this.ordersService.closeRegister(dto);
  }

  @Get("user-register/state")
  getUserRegisterState() {
    return this.ordersService.getUserRegisterState();
  }

  @Post("user-register/open")
  openUserRegister(@Body() dto: OpenJokerUserRegisterDto) {
    return this.ordersService.openUserRegister(dto);
  }

  @Post("user-register/close")
  closeUserRegister(@Body() dto: CloseJokerRegisterDto) {
    return this.ordersService.closeUserRegister(dto);
  }

  @Get("user-register/orders/current-period")
  listCurrentPeriodOrdersForUser() {
    return this.ordersService.listCurrentPeriodOrdersForUser();
  }

  @Get("panel/mes/:anio/:mes")
  getMonthSummary(@Param("anio", ParseIntPipe) anio: number, @Param("mes", ParseIntPipe) mes: number) {
    return this.reportingService.getMonthSummary(anio, mes);
  }

  @Get("panel/historial-meses")
  getMonthHistory(@Query("cantidad") cantidad?: string) {
    return this.reportingService.getMonthHistory(cantidad ? Number(cantidad) : 6);
  }

  @Patch("cierres/:fecha")
  editarCierreDia(@Param("fecha") fecha: string, @Body() dto: UpdateJokerCierreDiaDto) {
    return this.reportingService.editarCierreDia(fecha, dto);
  }
}
