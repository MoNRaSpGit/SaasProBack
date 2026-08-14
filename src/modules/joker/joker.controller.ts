import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { BulkApplyJokerRecipeDto } from "./dto/bulk-apply-joker-recipe.dto";
import { CloseJokerRegisterDto } from "./dto/close-joker-register.dto";
import { CreateJokerAccountEntryDto } from "./dto/create-joker-account-entry.dto";
import { CreateJokerClientDto } from "./dto/create-joker-client.dto";
import { CreateJokerOrderDto } from "./dto/create-joker-order.dto";
import { CreateJokerProductDto } from "./dto/create-joker-product.dto";
import { CreateJokerStockItemDto } from "./dto/create-joker-stock-item.dto";
import { ListJokerOrdersDto } from "./dto/list-joker-orders.dto";
import { RestockJokerStockItemDto } from "./dto/restock-joker-stock-item.dto";
import { SetJokerProductRecipeDto } from "./dto/set-joker-product-recipe.dto";
import { SignQzRequestDto } from "./dto/sign-qz-request.dto";
import { UpdateJokerCourierDto } from "./dto/update-joker-courier.dto";
import { UpdateJokerOrderDto } from "./dto/update-joker-order.dto";
import { UpdateJokerProductDto } from "./dto/update-joker-product.dto";
import { UpdateJokerStockItemDto } from "./dto/update-joker-stock-item.dto";
import { JokerService } from "./joker.service";

@Controller("joker")
export class JokerController {
  constructor(private readonly jokerService: JokerService) {}

  @Get("products")
  listProducts() {
    return this.jokerService.listProducts();
  }

  @Post("products")
  createProduct(@Body() dto: CreateJokerProductDto) {
    return this.jokerService.createProduct(dto);
  }

  @Patch("products/:id")
  updateProduct(@Param("id", ParseIntPipe) productId: number, @Body() dto: UpdateJokerProductDto) {
    return this.jokerService.updateProduct(productId, dto);
  }

  @Delete("products/:id")
  deleteProduct(@Param("id", ParseIntPipe) productId: number) {
    return this.jokerService.deleteProduct(productId);
  }

  @Get("products/:id/recipe")
  getProductRecipe(@Param("id", ParseIntPipe) productId: number) {
    return this.jokerService.getProductRecipe(productId);
  }

  @Patch("products/:id/recipe")
  setProductRecipe(@Param("id", ParseIntPipe) productId: number, @Body() dto: SetJokerProductRecipeDto) {
    return this.jokerService.setProductRecipe(productId, dto);
  }

  @Post("recipes/bulk-apply")
  bulkApplyRecipe(@Body() dto: BulkApplyJokerRecipeDto) {
    return this.jokerService.bulkApplyRecipe(dto);
  }

  @Get("stock-items")
  listStockItems() {
    return this.jokerService.listStockItems();
  }

  @Post("stock-items")
  createStockItem(@Body() dto: CreateJokerStockItemDto) {
    return this.jokerService.createStockItem(dto);
  }

  @Post("stock-items/:id/restock")
  restockItem(@Param("id", ParseIntPipe) stockItemId: number, @Body() dto: RestockJokerStockItemDto) {
    return this.jokerService.restockItem(stockItemId, dto);
  }

  @Patch("stock-items/:id")
  updateStockItemQuantity(@Param("id", ParseIntPipe) stockItemId: number, @Body() dto: UpdateJokerStockItemDto) {
    return this.jokerService.updateStockItemQuantity(stockItemId, dto);
  }

  @Get("stock-items/:id/consumption")
  getStockItemConsumption(@Param("id", ParseIntPipe) stockItemId: number) {
    return this.jokerService.getStockItemConsumption(stockItemId);
  }

  @Delete("stock-items/:id")
  deleteStockItem(@Param("id", ParseIntPipe) stockItemId: number) {
    return this.jokerService.deleteStockItem(stockItemId);
  }

  @Post("orders")
  createOrder(@Body() dto: CreateJokerOrderDto) {
    return this.jokerService.createOrder(dto);
  }

  @Patch("orders/:id")
  updateOrder(@Param("id", ParseIntPipe) orderId: number, @Body() dto: UpdateJokerOrderDto) {
    return this.jokerService.updateOrder(orderId, dto);
  }

  @Get("orders")
  listOrders(@Query() query: ListJokerOrdersDto) {
    return this.jokerService.listOrders(query);
  }

  @Get("orders/current-period")
  listCurrentPeriodOrders(@Query("courierId") courierId?: string) {
    return this.jokerService.listCurrentPeriodOrders(courierId ? Number(courierId) : undefined);
  }

  @Delete("orders")
  deleteAllOrders() {
    return this.jokerService.deleteAllOrders();
  }

  @Get("couriers")
  listCouriers() {
    return this.jokerService.listCouriers();
  }

  @Patch("couriers/:id")
  updateCourier(@Param("id", ParseIntPipe) courierId: number, @Body() dto: UpdateJokerCourierDto) {
    return this.jokerService.updateCourier(courierId, dto);
  }

  @Get("clients")
  listClients() {
    return this.jokerService.listClients();
  }

  @Post("clients")
  createClient(@Body() dto: CreateJokerClientDto) {
    return this.jokerService.createClient(dto);
  }

  @Delete("clients/:id")
  deleteClient(@Param("id", ParseIntPipe) clientId: number) {
    return this.jokerService.deleteClient(clientId);
  }

  @Get("account-entries")
  listAccountEntries() {
    return this.jokerService.listAccountEntries();
  }

  @Post("account-entries")
  createAccountEntry(@Body() dto: CreateJokerAccountEntryDto) {
    return this.jokerService.createAccountEntry(dto);
  }

  @Delete("account-entries/client/:clientId")
  settleAccount(@Param("clientId", ParseIntPipe) clientId: number) {
    return this.jokerService.settleAccount(clientId);
  }

  // Respaldo permanente de consumos ya pagados o de clientes eliminados,
  // para reclamos ("el cliente dice que no debia eso").
  @Get("account-settlements/client/:clientId")
  listAccountSettlements(@Param("clientId", ParseIntPipe) clientId: number) {
    return this.jokerService.listAccountSettlements(clientId);
  }

  // QZ Tray pide el certificado como texto plano (no JSON) via
  // setCertificatePromise.
  @Get("qz-certificate")
  getQzCertificate(@Res() res: Response) {
    res.type("text/plain").send(this.jokerService.getQzCertificate());
  }

  @Post("qz-sign")
  signQzRequest(@Body() dto: SignQzRequestDto) {
    return this.jokerService.signQzRequest(dto.toSign);
  }

  @Get("register/state")
  getRegisterState() {
    return this.jokerService.getRegisterState();
  }

  @Post("register/open")
  openRegister() {
    return this.jokerService.openRegister();
  }

  @Post("register/close")
  closeRegister(@Body() dto: CloseJokerRegisterDto) {
    return this.jokerService.closeRegister(dto);
  }
}
