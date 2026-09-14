import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { CreateQqProductDto } from "./dto/create-qq-product.dto";
import { UpdateQqProductDto } from "./dto/update-qq-product.dto";
import { QqProductsService } from "./qq-products.service";

@Controller("qq")
export class QqController {
  constructor(private readonly productsService: QqProductsService) {}

  @Get("products")
  listProducts(@Query("search") search?: string) {
    return this.productsService.listProducts(search);
  }

  @Post("products")
  createProduct(@Body() dto: CreateQqProductDto) {
    return this.productsService.createProduct(dto);
  }

  @Patch("products/:id")
  updateProduct(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateQqProductDto) {
    return this.productsService.updateProduct(id, dto);
  }

  @Delete("products/:id")
  deleteProduct(@Param("id", ParseIntPipe) id: number) {
    return this.productsService.deleteProduct(id);
  }
}
