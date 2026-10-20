import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { AlquilerService } from "./alquiler.service";
import { RegisterAlquilerPaymentDto } from "./dto/register-alquiler-payment.dto";
import { UpdateAlquilerLocalDto } from "./dto/update-alquiler-local.dto";

@Controller("alquiler")
export class AlquilerController {
  constructor(private readonly alquilerService: AlquilerService) {}

  @Get("locales")
  listLocales() {
    return this.alquilerService.listLocales();
  }

  @Patch("locales/:id")
  updateLocal(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateAlquilerLocalDto) {
    return this.alquilerService.updateLocal(id, dto);
  }

  @Post("locales/:id/payments")
  registerPayment(@Param("id", ParseIntPipe) id: number, @Body() dto: RegisterAlquilerPaymentDto) {
    return this.alquilerService.registerPayment(id, dto);
  }

  @Get("payments")
  listPayments(@Query("localId") localId?: string) {
    return this.alquilerService.listPayments(localId ? Number(localId) : undefined);
  }
}
