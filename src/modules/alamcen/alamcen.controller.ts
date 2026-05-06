import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { AlamcenService } from "./alamcen.service";
import { CreateManualProductDto } from "./dto/create-manual-product.dto";

@Controller("alamcen")
export class AlamcenController {
  constructor(private readonly alamcenService: AlamcenService) {}

  @Get("status")
  getStatus() {
    return this.alamcenService.getStatus();
  }

  @Get("productos/barcode/:barcode")
  getProductByBarcode(@Param("barcode") barcode: string) {
    return this.alamcenService.getProductByBarcode(barcode);
  }

  @Post("productos/manual")
  createManualProduct(@Body() payload: CreateManualProductDto) {
    return this.alamcenService.createManualProduct(payload);
  }
}
