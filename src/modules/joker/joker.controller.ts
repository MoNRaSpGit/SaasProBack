import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from "@nestjs/common";
import { CreateJokerProductDto } from "./dto/create-joker-product.dto";
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
}
