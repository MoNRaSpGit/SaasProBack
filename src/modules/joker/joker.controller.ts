import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { CreateJokerAccountEntryDto } from "./dto/create-joker-account-entry.dto";
import { CreateJokerClientDto } from "./dto/create-joker-client.dto";
import { CreateJokerOrderDto } from "./dto/create-joker-order.dto";
import { CreateJokerProductDto } from "./dto/create-joker-product.dto";
import { ListJokerOrdersDto } from "./dto/list-joker-orders.dto";
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
}
