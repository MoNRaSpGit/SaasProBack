import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { CreatePilotoPriceEntryDto } from "./dto/create-piloto-price-entry.dto";
import { CreatePilotoProductDto } from "./dto/create-piloto-product.dto";
import { CreatePilotoSaleDto } from "./dto/create-piloto-sale.dto";
import { SignQzRequestDto } from "./dto/sign-qz-request.dto";
import { UpdatePilotoPriceEntryDto } from "./dto/update-piloto-price-entry.dto";
import { UpdatePilotoProductDto } from "./dto/update-piloto-product.dto";
import { diffFields, PilotoAuditService } from "./piloto-audit.service";
import { PilotoPriceEntriesService } from "./piloto-price-entries.service";
import { PilotoPrintingService } from "./piloto-printing.service";
import { PilotoService } from "./piloto.service";

const PRODUCT_AUDIT_FIELDS = ["name", "price"] as const;

@Controller("piloto")
export class PilotoController {
  constructor(
    private readonly pilotoService: PilotoService,
    private readonly auditService: PilotoAuditService,
    private readonly printingService: PilotoPrintingService,
    private readonly priceEntriesService: PilotoPriceEntriesService
  ) {}

  @Get("products")
  listProducts(@Query("search") search?: string) {
    return this.pilotoService.listProducts(search);
  }

  @Get("products/barcode/:barcode")
  findByBarcode(@Param("barcode") barcode: string) {
    return this.pilotoService.findByBarcode(barcode);
  }

  @Post("products")
  async createProduct(@Body() dto: CreatePilotoProductDto) {
    const result = await this.pilotoService.createProduct(dto);
    await this.auditService.record({
      action: "create",
      entityType: "product",
      entityId: result.item.id,
      entityLabel: result.item.name,
      details: { barcode: result.item.barcode, price: result.item.price, stock: result.item.stock, status: result.item.status }
    });
    return result;
  }

  @Patch("products/:id")
  async updateProduct(@Param("id", ParseIntPipe) productId: number, @Body() dto: UpdatePilotoProductDto) {
    const before = await this.pilotoService.getProductOrThrow(productId);
    const result = await this.pilotoService.updateProduct(productId, dto);
    const changes = diffFields(before.item, result.item, PRODUCT_AUDIT_FIELDS);
    if (changes) {
      await this.auditService.record({
        action: "update",
        entityType: "product",
        entityId: productId,
        entityLabel: result.item.name,
        details: { changes }
      });
    }
    return result;
  }

  @Post("sales")
  async createSale(@Body() dto: CreatePilotoSaleDto) {
    const result = await this.pilotoService.createSale(dto);
    await this.auditService.record({
      action: "sale",
      entityType: "sale",
      entityId: result.item.id,
      entityLabel: `Venta #${result.item.id}`,
      details: {
        paymentMethod: result.item.paymentMethod,
        totalAmount: result.item.totalAmount,
        itemsCount: result.item.itemsCount,
        items: dto.items.map((item) => ({ name: item.name, quantity: item.quantity, price: item.price }))
      }
    });
    return result;
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

  // QZ Tray pide el certificado como texto plano (no JSON) via
  // GET/POST directo -- ver PilotoPrintingService.
  @Get("qz-certificate")
  getQzCertificate(@Res() res: Response) {
    res.type("text/plain").send(this.printingService.getQzCertificate());
  }

  @Post("qz-sign")
  signQzRequest(@Body() dto: SignQzRequestDto) {
    return this.printingService.signQzRequest(dto.toSign);
  }

  // "Precios" -- Modo Pro (23/09/2026): lista de precios por categoria,
  // independiente de los productos del escaner.
  @Get("price-entries")
  listPriceEntries() {
    return this.priceEntriesService.listPriceEntries();
  }

  @Post("price-entries")
  createPriceEntry(@Body() dto: CreatePilotoPriceEntryDto) {
    return this.priceEntriesService.createPriceEntry(dto);
  }

  @Patch("price-entries/:id")
  updatePriceEntry(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdatePilotoPriceEntryDto) {
    return this.priceEntriesService.updatePriceEntry(id, dto);
  }

  @Delete("price-entries/:id")
  deletePriceEntry(@Param("id", ParseIntPipe) id: number) {
    return this.priceEntriesService.deletePriceEntry(id);
  }

  // "Panel de control" -- Modo Pro (24/09/2026): ventas, ganancia
  // (30% de las ventas) y el detalle de cada venta del dia. Sin `date`
  // (YYYY-MM-DD), es el dia de hoy (Montevideo).
  @Get("sales/summary")
  getSalesSummary(@Query("date") date?: string) {
    return this.pilotoService.getSalesSummary(date);
  }
}
