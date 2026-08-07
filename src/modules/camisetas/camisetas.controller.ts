import { Body, Controller, Get, Post } from "@nestjs/common";
import { CamisetasService } from "./camisetas.service";
import { CreateCamisetasCheckoutDto } from "./dto/create-camisetas-checkout.dto";

@Controller("camisetas")
export class CamisetasController {
  constructor(private readonly camisetasService: CamisetasService) {}

  @Get("products")
  getProducts() {
    return this.camisetasService.getProducts();
  }

  @Post("checkout")
  createCheckoutPreference(@Body() dto: CreateCamisetasCheckoutDto) {
    return this.camisetasService.createCheckoutPreference(dto.productId);
  }
}
