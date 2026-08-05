import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { CloseJokerRegisterDto } from "./dto/close-joker-register.dto";
import { CreateJokerAccountEntryDto } from "./dto/create-joker-account-entry.dto";
import { CreateJokerClientDto } from "./dto/create-joker-client.dto";
import { CreateJokerOrderDto } from "./dto/create-joker-order.dto";
import { CreateJokerProductDto } from "./dto/create-joker-product.dto";
import { ListJokerOrdersDto } from "./dto/list-joker-orders.dto";
import { SignQzRequestDto } from "./dto/sign-qz-request.dto";
import { UpdateJokerProductDto } from "./dto/update-joker-product.dto";
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

  @Post("orders")
  createOrder(@Body() dto: CreateJokerOrderDto) {
    return this.jokerService.createOrder(dto);
  }

  @Get("orders")
  listOrders(@Query() query: ListJokerOrdersDto) {
    return this.jokerService.listOrders(query);
  }

  @Get("orders/current-period")
  listCurrentPeriodOrders() {
    return this.jokerService.listCurrentPeriodOrders();
  }

  @Delete("orders")
  deleteAllOrders() {
    return this.jokerService.deleteAllOrders();
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
