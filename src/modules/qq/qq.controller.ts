import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UnauthorizedException
} from "@nestjs/common";
import type { Request, Response } from "express";
import { CreateQqCategoryDto, MoveQqCategoryDto, RenameQqCategoryDto } from "./dto/qq-category.dto";
import { CreateQqClientDto } from "./dto/create-qq-client.dto";
import { CreateQqProductDto } from "./dto/create-qq-product.dto";
import { ReorderQqProductDto } from "./dto/reorder-qq-product.dto";
import { UploadQqCarouselImageDto } from "./dto/upload-qq-carousel-image.dto";
import { UploadQqProductImageDto } from "./dto/upload-qq-product-image.dto";
import { UpdateQqClientDto } from "./dto/update-qq-client.dto";
import { UpdateQqDiscountConfigDto } from "./dto/update-qq-discount-config.dto";
import { UpdateQqProductDto } from "./dto/update-qq-product.dto";
import { WhatsAppCheckoutDto } from "./dto/whatsapp-checkout-qq.dto";
import { TrackQqEventDto } from "./dto/track-qq-event.dto";
import { diffFields, QqAuditService } from "./qq-audit.service";
import { QqAuthService } from "./qq-auth.service";
import { QqCarouselService } from "./qq-carousel.service";
import { QqCategoriesService } from "./qq-categories.service";
import { QqClientsService } from "./qq-clients.service";
import { QqDiscountService } from "./qq-discount.service";
import { QqProductsService } from "./qq-products.service";
import { QqDiscountConfig, QqUser } from "./qq.types";

function extractBearerToken(authorization: string | undefined): string | undefined {
  if (!authorization?.startsWith("Bearer ")) return undefined;
  return authorization.slice("Bearer ".length).trim() || undefined;
}

// Campos que se comparan para el registro de auditoria al editar (ver
// qq-audit.service.ts). No incluye id/createdAt/position (position se
// audita aparte, con la accion "reorder").
const PRODUCT_AUDIT_FIELDS = [
  "name",
  "description",
  "accountPrice",
  "profilePrice",
  "currency",
  "billingType",
  "category",
  "status",
  "imageUrl"
] as const;
const CLIENT_AUDIT_FIELDS = ["name", "email", "phone", "dueDate"] as const;
const DISCOUNT_CONFIG_AUDIT_FIELDS = ["code", "percentage", "enabled", "extraCodes"] as const;

// extraCodes es una lista: se aplana a texto para que diffFields la compare por valor.
const flattenDiscount = (config: QqDiscountConfig) => ({
  ...config,
  extraCodes: config.extraCodes.map((item) => `${item.code} (${item.percentage}%)`).join(", ")
});

// Limite del punto de entrada publico de "Comprar por WhatsApp" (ver
// reportWhatsAppCheckout): como cualquiera puede llamarlo, se topea por IP
// para que nadie pueda llenar el registro. En memoria (se reinicia con el
// servidor) -- alcanza para frenar abuso, no es un dato que importe.
const CHECKOUT_REPORT_LIMIT = 15;
const CHECKOUT_REPORT_WINDOW_MS = 60 * 60 * 1000;
const checkoutReportsByIp = new Map<string, number[]>();

function isCheckoutReportAllowed(ip: string): boolean {
  const now = Date.now();
  const recent = (checkoutReportsByIp.get(ip) ?? []).filter((timestamp) => now - timestamp < CHECKOUT_REPORT_WINDOW_MS);
  if (recent.length >= CHECKOUT_REPORT_LIMIT) {
    checkoutReportsByIp.set(ip, recent);
    return false;
  }
  recent.push(now);
  checkoutReportsByIp.set(ip, recent);

  if (checkoutReportsByIp.size > 2000) {
    for (const [key, timestamps] of checkoutReportsByIp) {
      if (timestamps.every((timestamp) => now - timestamp >= CHECKOUT_REPORT_WINDOW_MS)) {
        checkoutReportsByIp.delete(key);
      }
    }
  }
  return true;
}

// Tope aparte para los eventos de visitantes (visita, tarjeta abierta,
// carrito...): son muchos mas por persona que los de "Comprar por WhatsApp".
const TRACK_LIMIT = 300;
const TRACK_WINDOW_MS = 60 * 60 * 1000;
const trackEventsByIp = new Map<string, number[]>();

function isTrackAllowed(ip: string): boolean {
  const now = Date.now();
  const recent = (trackEventsByIp.get(ip) ?? []).filter((timestamp) => now - timestamp < TRACK_WINDOW_MS);
  if (recent.length >= TRACK_LIMIT) {
    trackEventsByIp.set(ip, recent);
    return false;
  }
  recent.push(now);
  trackEventsByIp.set(ip, recent);
  if (trackEventsByIp.size > 2000) {
    for (const [key, timestamps] of trackEventsByIp) {
      if (timestamps.every((timestamp) => now - timestamp >= TRACK_WINDOW_MS)) trackEventsByIp.delete(key);
    }
  }
  return true;
}

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
  return first || req.ip || "desconocida";
}

@Controller("qq")
export class QqController {
  constructor(
    private readonly productsService: QqProductsService,
    private readonly authService: QqAuthService,
    private readonly carouselService: QqCarouselService,
    private readonly clientsService: QqClientsService,
    private readonly auditService: QqAuditService,
    private readonly discountService: QqDiscountService,
    private readonly categoriesService: QqCategoriesService
  ) {}

  // Ver el catalogo es publico -- solo cargar/editar/borrar productos
  // requiere estar logueado como administrador (ver requireAdmin).
  @Get("products")
  listProducts(@Query("search") search?: string) {
    return this.productsService.listProducts(search);
  }

  @Post("products")
  async createProduct(@Headers("authorization") authorization: string | undefined, @Body() dto: CreateQqProductDto) {
    const admin = await this.requireAdmin(authorization);
    const result = await this.productsService.createProduct(dto);
    await this.auditService.record({
      action: "create",
      entityType: "product",
      entityId: result.item.id,
      entityLabel: result.item.name,
      actor: admin,
      details: {
        category: result.item.category,
        accountPrice: result.item.accountPrice,
        profilePrice: result.item.profilePrice,
        status: result.item.status
      }
    });
    return result;
  }

  @Patch("products/:id")
  async updateProduct(
    @Headers("authorization") authorization: string | undefined,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateQqProductDto
  ) {
    const admin = await this.requireAdmin(authorization);
    const before = await this.productsService.getProductOrThrow(id);
    const result = await this.productsService.updateProduct(id, dto);
    const changes = diffFields(before.item, result.item, PRODUCT_AUDIT_FIELDS);
    if (changes) {
      await this.auditService.record({
        action: "update",
        entityType: "product",
        entityId: id,
        entityLabel: result.item.name,
        actor: admin,
        details: { changes }
      });
    }
    return result;
  }

  @Delete("products/:id")
  async deleteProduct(@Headers("authorization") authorization: string | undefined, @Param("id", ParseIntPipe) id: number) {
    const admin = await this.requireAdmin(authorization);
    const before = await this.productsService.getProductOrThrow(id);
    const result = await this.productsService.deleteProduct(id);
    await this.auditService.record({
      action: "delete",
      entityType: "product",
      entityId: id,
      entityLabel: before.item.name,
      actor: admin,
      details: {
        category: before.item.category,
        accountPrice: before.item.accountPrice,
        profilePrice: before.item.profilePrice,
        status: before.item.status
      }
    });
    return result;
  }

  // Orden manual del catalogo (16/09/2026): mover un producto a un
  // puesto swapea con el que ya estaba ahi (ver
  // qq-products.service.ts#reorderProduct).
  @Patch("products/:id/position")
  async reorderProduct(
    @Headers("authorization") authorization: string | undefined,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ReorderQqProductDto
  ) {
    const admin = await this.requireAdmin(authorization);
    const before = await this.productsService.getProductOrThrow(id);
    const result = await this.productsService.reorderProduct(id, dto.position);
    if (before.item.position !== result.item.position) {
      await this.auditService.record({
        action: "reorder",
        entityType: "product",
        entityId: id,
        entityLabel: result.item.name,
        actor: admin,
        details: { position: [before.item.position, result.item.position] }
      });
    }
    return result;
  }

  // Sirve la imagen en binario (no en el JSON del producto) con cache
  // fuerte via ETag -- mismo criterio que frontend-piloto.
  @Get("products/:id/image")
  async getProductImage(@Param("id", ParseIntPipe) productId: number, @Req() req: Request, @Res() res: Response) {
    const image = await this.productsService.getProductImage(productId);
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

  @Post("products/:id/image")
  async uploadProductImage(
    @Headers("authorization") authorization: string | undefined,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UploadQqProductImageDto
  ) {
    const admin = await this.requireAdmin(authorization);
    const before = await this.productsService.getProductOrThrow(id);
    const result = await this.productsService.setProductImage(id, dto.dataUri);
    // Solo el tamaño aproximado, nunca el binario ni el data URI.
    await this.auditService.record({
      action: "upload_image",
      entityType: "product_image",
      entityId: id,
      entityLabel: result.item.name,
      actor: admin,
      details: { replacedExistingImage: before.item.hasImage, approxSizeKb: Math.round((dto.dataUri.length * 0.75) / 1024) }
    });
    return result;
  }

  // Fotos extra del producto (17/11/2026): el admin suma/quita otros angulos que
  // se pasan dentro del detalle. La lista viaja en el propio producto (gallery).
  @Post("products/:id/gallery")
  async addProductGalleryImage(
    @Headers("authorization") authorization: string | undefined,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UploadQqProductImageDto
  ) {
    const admin = await this.requireAdmin(authorization);
    const result = await this.productsService.addGalleryImage(id, dto.dataUri);
    await this.auditService.record({
      action: "upload_image",
      entityType: "product_image",
      entityId: id,
      entityLabel: `${result.item.name} (foto extra)`,
      actor: admin,
      details: { galleryCount: result.item.gallery.length, approxSizeKb: Math.round((dto.dataUri.length * 0.75) / 1024) }
    });
    return result;
  }

  @Delete("products/:id/gallery/:imageId")
  async deleteProductGalleryImage(
    @Headers("authorization") authorization: string | undefined,
    @Param("id", ParseIntPipe) id: number,
    @Param("imageId", ParseIntPipe) imageId: number
  ) {
    const admin = await this.requireAdmin(authorization);
    const result = await this.productsService.deleteGalleryImage(id, imageId);
    await this.auditService.record({
      action: "delete",
      entityType: "product_image",
      entityId: id,
      entityLabel: `${result.item.name} (foto extra)`,
      actor: admin,
      details: { galleryCount: result.item.gallery.length }
    });
    return result;
  }

  // Categorias y subcategorias (16/11/2026): el listado es publico (lo usa el
  // catalogo); crear, renombrar, ordenar y borrar exige administrador.
  @Get("categories")
  listCategories() {
    return this.categoriesService.list();
  }

  @Post("categories")
  async createCategory(@Headers("authorization") authorization: string | undefined, @Body() dto: CreateQqCategoryDto) {
    const admin = await this.requireAdmin(authorization);
    const created = await this.categoriesService.create(dto.label, dto.parentId);
    await this.auditService.record({
      action: "create",
      entityType: "category",
      entityId: created.id,
      entityLabel: created.label,
      actor: admin,
      details: { key: created.key, parentId: dto.parentId ?? null }
    });
    return created;
  }

  @Patch("categories/:id")
  async renameCategory(
    @Headers("authorization") authorization: string | undefined,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: RenameQqCategoryDto
  ) {
    const admin = await this.requireAdmin(authorization);
    const change = await this.categoriesService.rename(id, dto.label);
    await this.auditService.record({
      action: "update",
      entityType: "category",
      entityId: id,
      entityLabel: change.after,
      actor: admin,
      details: { label: [change.before, change.after] }
    });
    return { ok: true };
  }

  @HttpCode(HttpStatus.OK)
  @Post("categories/:id/move")
  async moveCategory(
    @Headers("authorization") authorization: string | undefined,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: MoveQqCategoryDto
  ) {
    const admin = await this.requireAdmin(authorization);
    const result = await this.categoriesService.move(id, dto.direction);
    await this.auditService.record({ action: "reorder", entityType: "category", entityId: id, actor: admin, details: { direction: dto.direction } });
    return result;
  }

  @Delete("categories/:id")
  async deleteCategory(@Headers("authorization") authorization: string | undefined, @Param("id", ParseIntPipe) id: number) {
    const admin = await this.requireAdmin(authorization);
    const result = await this.categoriesService.remove(id);
    await this.auditService.record({ action: "delete", entityType: "category", entityId: id, entityLabel: result.label, actor: admin });
    return { ok: true };
  }

  // Carrusel de fondos (15/09/2026): el admin carga fotos desde una
  // pestaña propia y el sitio va rotando entre ellas + la foto original
  // fija (esa vive en public/, no aca) como fondo de toda la pagina.
  // Ver el listado/las imagenes es publico, cargar/borrar exige admin.
  @Get("carousel")
  listCarouselImages() {
    return this.carouselService.listImages();
  }

  @Post("carousel")
  async addCarouselImage(@Headers("authorization") authorization: string | undefined, @Body() dto: UploadQqCarouselImageDto) {
    const admin = await this.requireAdmin(authorization);
    const result = await this.carouselService.addImage(dto.dataUri);
    await this.auditService.record({
      action: "create",
      entityType: "carousel_image",
      entityId: result.item.id,
      entityLabel: `Imagen del carrusel #${result.item.id}`,
      actor: admin,
      details: { approxSizeKb: Math.round((dto.dataUri.length * 0.75) / 1024) }
    });
    return result;
  }

  // Version PC (16/11/2026): pone o reemplaza la imagen de PC de un slide.
  @Put("carousel/:id/desktop")
  async setCarouselDesktopImage(
    @Headers("authorization") authorization: string | undefined,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UploadQqCarouselImageDto
  ) {
    const admin = await this.requireAdmin(authorization);
    const result = await this.carouselService.setDesktopImage(id, dto.dataUri);
    await this.auditService.record({
      action: "update",
      entityType: "carousel_image",
      entityId: id,
      entityLabel: `Imagen del carrusel #${id} (version PC)`,
      actor: admin,
      details: { approxSizeKb: Math.round((dto.dataUri.length * 0.75) / 1024) }
    });
    return result;
  }

  @Delete("carousel/:id")
  async deleteCarouselImage(@Headers("authorization") authorization: string | undefined, @Param("id", ParseIntPipe) id: number) {
    const admin = await this.requireAdmin(authorization);
    const result = await this.carouselService.deleteImage(id);
    await this.auditService.record({
      action: "delete",
      entityType: "carousel_image",
      entityId: id,
      entityLabel: `Imagen del carrusel #${id}`,
      actor: admin
    });
    return result;
  }

  @Get("carousel/:id/image")
  async getCarouselImage(
    @Param("id", ParseIntPipe) imageId: number,
    @Query("variant") variant: string | undefined,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const image = await this.carouselService.getCarouselImage(imageId, variant === "desktop" ? "desktop" : "mobile");
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

  // "Comprar por WhatsApp" (19/09/2026, pedido explicito: contabilizar las
  // ventas cuando detectamos ese click). OJO: qq no tiene checkout -- el
  // pedido se cierra por WhatsApp, afuera del sistema -- asi que esto
  // registra una INTENCION de compra (el cliente toco el boton con este
  // carrito), no una venta confirmada. Es publico (sin login), por eso se
  // topea por IP y siempre responde 200 aunque no registre nada: nunca debe
  // poner trabas ni errores en el camino del cliente hacia WhatsApp.
  @HttpCode(HttpStatus.OK)
  @Post("events/whatsapp-checkout")
  async reportWhatsAppCheckout(@Req() req: Request, @Body() dto: WhatsAppCheckoutDto) {
    if (isCheckoutReportAllowed(getClientIp(req))) {
      const itemCount = dto.items.reduce((sum, item) => sum + item.quantity, 0);
      await this.auditService.record({
        action: "checkout_whatsapp",
        entityType: "cart",
        entityLabel: `${itemCount} suscripcion(es) por $${dto.total}/mes`,
        details: { total: dto.total, items: dto.items }
      });
    }
    return { ok: true };
  }

  // Visitantes (30/10/2026, pedido explicito): "contar las visitas... si es
  // el administrador, ni lo cuentes" (el frontend no manda nada si hay un
  // admin logueado) + el recorrido de cada visita. Publico y siempre 200,
  // igual que el de WhatsApp: nunca puede molestar al visitante.
  @HttpCode(HttpStatus.OK)
  @Post("events/track")
  async trackVisitorEvent(@Req() req: Request, @Body() dto: TrackQqEventDto) {
    if (isTrackAllowed(getClientIp(req))) {
      await this.auditService.record({
        action: dto.event,
        entityType: "visitor",
        entityId: dto.visitorId,
        entityLabel: dto.label ?? null,
        details: dto.productId ? { productId: dto.productId } : null
      });
    }
    return { ok: true };
  }

  // Cuenta corriente de clientes (15/09/2026) -- a diferencia de
  // productos/carrusel, esto es SOLO para el admin (email/telefono de
  // clientes reales, nada publico aca).
  // Visitas de la tienda (21/11/2026): solo el admin. ?days=1|7|30.
  @Get("admin/visits")
  async visits(@Headers("authorization") authorization: string | undefined, @Query("days") days?: string) {
    await this.requireAdmin(authorization);
    return this.auditService.visits(Number(days) || 7);
  }

  @Get("clients")
  async listClients(@Headers("authorization") authorization: string | undefined) {
    await this.requireAdmin(authorization);
    return this.clientsService.listClients();
  }

  @Post("clients")
  async createClient(@Headers("authorization") authorization: string | undefined, @Body() dto: CreateQqClientDto) {
    const admin = await this.requireAdmin(authorization);
    const result = await this.clientsService.createClient(dto);
    await this.auditService.record({
      action: "create",
      entityType: "client",
      entityId: result.item.id,
      entityLabel: result.item.name,
      actor: admin,
      details: { dueDate: result.item.dueDate }
    });
    return result;
  }

  @Patch("clients/:id")
  async updateClient(
    @Headers("authorization") authorization: string | undefined,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateQqClientDto
  ) {
    const admin = await this.requireAdmin(authorization);
    const before = await this.clientsService.getClientOrThrow(id);
    const result = await this.clientsService.updateClient(id, dto);
    const changes = diffFields(before.item, result.item, CLIENT_AUDIT_FIELDS);
    if (changes) {
      await this.auditService.record({
        action: "update",
        entityType: "client",
        entityId: id,
        entityLabel: result.item.name,
        actor: admin,
        details: { changes }
      });
    }
    return result;
  }

  @Delete("clients/:id")
  async deleteClient(@Headers("authorization") authorization: string | undefined, @Param("id", ParseIntPipe) id: number) {
    const admin = await this.requireAdmin(authorization);
    const before = await this.clientsService.getClientOrThrow(id);
    const result = await this.clientsService.deleteClient(id);
    await this.auditService.record({
      action: "delete",
      entityType: "client",
      entityId: id,
      entityLabel: before.item.name,
      actor: admin,
      details: { dueDate: before.item.dueDate }
    });
    return result;
  }

  // Codigo de descuento (28/09/2026, pedido explicito): ver es publico
  // (el carrito necesita saber si mostrar el input), cambiarlo exige
  // admin -- mismo criterio que carrusel/productos.
  @Get("discount-config")
  getDiscountConfig() {
    return this.discountService.getConfig();
  }

  @Patch("discount-config")
  async updateDiscountConfig(
    @Headers("authorization") authorization: string | undefined,
    @Body() dto: UpdateQqDiscountConfigDto
  ) {
    const admin = await this.requireAdmin(authorization);
    const before = await this.discountService.getConfig();
    const result = await this.discountService.updateConfig(dto);
    const changes = diffFields(flattenDiscount(before.item), flattenDiscount(result.item), DISCOUNT_CONFIG_AUDIT_FIELDS);
    if (changes) {
      await this.auditService.record({
        action: "update",
        entityType: "discount_config",
        entityLabel: "Código de descuento",
        actor: admin,
        details: { changes }
      });
    }
    return result;
  }

  private async requireAdmin(authorization: string | undefined): Promise<QqUser> {
    const token = extractBearerToken(authorization);
    const user = await this.authService.getUserForToken(token);
    if (!user) {
      throw new UnauthorizedException("Iniciá sesión para hacer esto");
    }
    if (user.role !== "administrador") {
      throw new ForbiddenException("Solo un administrador puede hacer esto");
    }
    return user;
  }
}
