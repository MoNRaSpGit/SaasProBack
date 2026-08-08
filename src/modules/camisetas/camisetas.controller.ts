import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { CamisetasAdminGuard } from "./camisetas-admin.guard";
import { CamisetasService } from "./camisetas.service";
import { CamisetasAdminLoginDto } from "./dto/camisetas-admin-login.dto";
import { CreateCamisetasCheckoutDto } from "./dto/create-camisetas-checkout.dto";
import { UpdateCamisetasProductDto } from "./dto/update-camisetas-product.dto";
import { UpdateCamisetasProductImageDto } from "./dto/update-camisetas-product-image.dto";

@Controller("camisetas")
export class CamisetasController {
  constructor(private readonly camisetasService: CamisetasService) {}

  @Get("products")
  getProducts() {
    return this.camisetasService.getProducts();
  }

  // Sirve la imagen en binario, con cache fuerte via ETag.
  @Get("products/:id/image")
  async getProductImage(@Param("id") productId: string, @Req() req: Request, @Res() res: Response) {
    const image = await this.camisetasService.getProductImage(productId);
    if (!image) {
      res.status(404).end();
      return;
    }

    const etag = `"${image.sourceHash}"`;
    if (req.headers["if-none-match"] === etag) {
      res.status(304).end();
      return;
    }

    res.set({
      "Content-Type": image.mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: etag
    });
    res.send(image.buffer);
  }

  @Post("checkout")
  createCheckoutPreference(@Body() dto: CreateCamisetasCheckoutDto) {
    return this.camisetasService.createCheckoutPreference(dto.items, dto.customerName, dto.customerPhone);
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

  @Post("admin/login")
  loginAdmin(@Body() dto: CamisetasAdminLoginDto) {
    return this.camisetasService.loginAdmin(dto.username, dto.password);
  }

  @Get("panel/summary")
  @UseGuards(CamisetasAdminGuard)
  getPanelSummary() {
    return this.camisetasService.getPanelSummary();
  }

  @Patch("products/:id")
  @UseGuards(CamisetasAdminGuard)
  updateProduct(@Param("id") productId: string, @Body() dto: UpdateCamisetasProductDto) {
    return this.camisetasService.updateProduct(productId, dto);
  }

  @Post("products/:id/image")
  @UseGuards(CamisetasAdminGuard)
  async setProductImage(@Param("id") productId: string, @Body() dto: UpdateCamisetasProductImageDto) {
    await this.camisetasService.setProductImage(productId, dto.image);
    return { ok: true };
  }
}
