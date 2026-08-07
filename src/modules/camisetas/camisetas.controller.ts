import { Controller, Get, Post } from "@nestjs/common";
import { CamisetasService } from "./camisetas.service";

@Controller("camisetas")
export class CamisetasController {
  constructor(private readonly camisetasService: CamisetasService) {}

  @Get("product")
  getProduct() {
    return this.camisetasService.getProduct();
  }

  @Post("checkout")
  createCheckoutPreference() {
    return this.camisetasService.createCheckoutPreference();
  }
}
