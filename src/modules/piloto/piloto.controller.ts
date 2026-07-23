import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { CreatePilotoProductDto } from "./dto/create-piloto-product.dto";
import { CreatePilotoSaleDto } from "./dto/create-piloto-sale.dto";
import { UpdatePilotoProductDto } from "./dto/update-piloto-product.dto";
import { PilotoService } from "./piloto.service";

@Controller("piloto")
export class PilotoController {
  constructor(private readonly pilotoService: PilotoService) {}

  @Get("products")
  listProducts(@Query("search") search?: string) {
    return this.pilotoService.listProducts(search);
  }

  @Get("products/barcode/:barcode")
  findByBarcode(@Param("barcode") barcode: string) {
    return this.pilotoService.findByBarcode(barcode);
  }

  @Post("products")
  createProduct(@Body() dto: CreatePilotoProductDto) {
    return this.pilotoService.createProduct(dto);
  }

  @Patch("products/:id")
  updateProduct(@Param("id", ParseIntPipe) productId: number, @Body() dto: UpdatePilotoProductDto) {
    return this.pilotoService.updateProduct(productId, dto);
  }

  @Post("sales")
  createSale(@Body() dto: CreatePilotoSaleDto) {
    return this.pilotoService.createSale(dto);
  }

  @Post("cache/product-lookup/reset")
  resetProductLookupCache() {
    return this.pilotoService.resetProductLookupCache();
  }
}
