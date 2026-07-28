import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
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
}
