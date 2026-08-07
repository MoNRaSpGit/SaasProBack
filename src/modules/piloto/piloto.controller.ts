import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
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

  // Sirve la imagen en binario (no en el JSON del producto) con cache
  // fuerte via ETag: el navegador la pide una sola vez y la reusa despues,
  // en vez de bajar el base64 completo en cada busqueda por codigo de barra.
  @Get("products/:id/image")
  async getProductImage(@Param("id", ParseIntPipe) productId: number, @Req() req: Request, @Res() res: Response) {
    const image = await this.pilotoService.getProductImage(productId);
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
}
