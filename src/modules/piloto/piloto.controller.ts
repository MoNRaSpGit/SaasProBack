import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { CreatePilotoProductDto } from "./dto/create-piloto-product.dto";
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
}
