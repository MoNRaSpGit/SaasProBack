import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { CreateGabyAccountEntryDto } from "./dto/create-gaby-account-entry.dto";
import { CreateGabyClientDto } from "./dto/create-gaby-client.dto";
import { CreateGabyProductDto } from "./dto/create-gaby-product.dto";
import { CreateGabySaleDto } from "./dto/create-gaby-sale.dto";
import { SetGabyProductImageDto } from "./dto/set-gaby-product-image.dto";
import { SetGabyStockDto } from "./dto/set-gaby-stock.dto";
import { UpdateGabyProductDto } from "./dto/update-gaby-product.dto";
import { diffFields, GabyAuditService } from "./gaby-audit.service";
import { GabyClientsService } from "./gaby-clients.service";
import { GabyService } from "./gaby.service";

const PRODUCT_AUDIT_FIELDS = ["name", "price", "stock"] as const;

// Gaby Almacen (07/11/2026): version BASICA de Piloto para una clienta
// nueva -- escaner + venta + cuenta corriente (clientes). Mismas rutas
// que Piloto pero bajo /gaby, con sus propias tablas (saas_gaby_*). Sin
// cajas, tablet del fondo, precios, tickets ni impresion.
@Controller("gaby")
export class GabyController {
  constructor(
    private readonly gabyService: GabyService,
    private readonly auditService: GabyAuditService,
    private readonly clientsService: GabyClientsService
  ) {}

  @Get("products")
  listProducts(@Query("search") search?: string, @Query("ids") ids?: string) {
    const parsedIds = ids
      ? ids
          .split(",")
          .map((id) => Number(id.trim()))
          .filter((id) => Number.isFinite(id))
      : undefined;
    return this.gabyService.listProducts(search, parsedIds);
  }

  @Get("stock")
  listStock(@Query("search") search?: string) {
    return this.gabyService.listStock(search);
  }

  @Patch("products/:id/stock")
  async setStock(@Param("id", ParseIntPipe) productId: number, @Body() dto: SetGabyStockDto) {
    const before = await this.gabyService.getProductOrThrow(productId);
    const result = await this.gabyService.setStock(productId, dto.stock);
    const changes = diffFields(before.item, result.item, ["stock"] as const);
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

  @Get("products/barcode/:barcode")
  findByBarcode(@Param("barcode") barcode: string) {
    return this.gabyService.findByBarcode(barcode);
  }

  @Post("products")
  async createProduct(@Body() dto: CreateGabyProductDto) {
    const result = await this.gabyService.createProduct(dto);
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
  async updateProduct(@Param("id", ParseIntPipe) productId: number, @Body() dto: UpdateGabyProductDto) {
    const before = await this.gabyService.getProductOrThrow(productId);
    const result = await this.gabyService.updateProduct(productId, dto);
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
  async createSale(@Body() dto: CreateGabySaleDto) {
    const result = await this.gabyService.createSale(dto);
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

  @Get("products/:id/image")
  async getProductImage(@Param("id", ParseIntPipe) productId: number, @Req() req: Request, @Res() res: Response) {
    const image = await this.gabyService.getProductImage(productId);
    if (!image) {
      res.status(404).end();
      return;
    }

    if ("cloudinaryUrl" in image) {
      res.set({ "Cache-Control": "public, max-age=31536000, immutable" });
      res.redirect(302, image.cloudinaryUrl);
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

  @Post("products/:id/image")
  async setProductImage(@Param("id", ParseIntPipe) productId: number, @Body() dto: SetGabyProductImageDto) {
    await this.gabyService.getProductOrThrow(productId);
    const result = await this.gabyService.setProductImage(productId, dto.dataUri);
    await this.auditService.record({
      action: "update",
      entityType: "product",
      entityId: productId,
      entityLabel: `Producto #${productId}`,
      details: { imageUpdated: true }
    });
    return result;
  }

  @Get("sales/summary")
  getSalesSummary(@Query("date") date?: string) {
    return this.gabyService.getSalesSummary(date);
  }

  @Get("clients")
  listClients() {
    return this.clientsService.listClients();
  }

  @Post("clients")
  createClient(@Body() dto: CreateGabyClientDto) {
    return this.clientsService.createClient(dto);
  }

  @Delete("clients/:id")
  async deleteClient(@Param("id", ParseIntPipe) id: number) {
    await this.clientsService.deleteClient(id);
    return { ok: true };
  }

  @Get("account-entries")
  listAccountEntries(@Query("clientId") clientId?: string) {
    return this.clientsService.listAccountEntries(clientId ? Number(clientId) : undefined);
  }

  @Post("account-entries")
  createAccountEntry(@Body() dto: CreateGabyAccountEntryDto) {
    return this.clientsService.createAccountEntry(dto);
  }

  @Delete("account-entries/client/:clientId")
  async settleAccount(@Param("clientId", ParseIntPipe) clientId: number) {
    await this.clientsService.settleAccount(clientId);
    return { ok: true };
  }
}
