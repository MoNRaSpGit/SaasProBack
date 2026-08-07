import { Body, Controller, Get, Post, Query } from "@nestjs/common";
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

  // Mercado Pago llama esta ruta (IPN/webhook) cuando cambia el estado de un
  // pago. El id puede venir por query (?data.id=...&type=payment) o por body,
  // segun la version de notificacion que mande Mercado Pago.
  @Post("webhook")
  async handleWebhook(@Query() query: Record<string, string>, @Body() body: Record<string, unknown>) {
    const paymentId =
      query["data.id"] ||
      query["id"] ||
      (body?.data as { id?: string } | undefined)?.id ||
      (typeof body?.id === "string" ? body.id : undefined);

    await this.camisetasService.handlePaymentNotification(paymentId as string | undefined);
    return { received: true };
  }

  @Get("panel/summary")
  getPanelSummary() {
    return this.camisetasService.getPanelSummary();
  }
}
