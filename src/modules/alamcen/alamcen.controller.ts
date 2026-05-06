import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { AlamcenService } from "./alamcen.service";
import { CreateManualProductDto } from "./dto/create-manual-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

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

  @Patch("productos/:productId")
  updateProduct(@Param("productId") productId: string, @Body() payload: UpdateProductDto) {
    return this.alamcenService.updateProduct(Number(productId), payload);
  }
}
