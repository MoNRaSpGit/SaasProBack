import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException
} from "@nestjs/common";
import type { Request, Response } from "express";
import { CreateQqClientDto } from "./dto/create-qq-client.dto";
import { CreateQqProductDto } from "./dto/create-qq-product.dto";
import { ReorderQqProductDto } from "./dto/reorder-qq-product.dto";
import { UploadQqCarouselImageDto } from "./dto/upload-qq-carousel-image.dto";
import { UploadQqProductImageDto } from "./dto/upload-qq-product-image.dto";
import { UpdateQqClientDto } from "./dto/update-qq-client.dto";
import { UpdateQqProductDto } from "./dto/update-qq-product.dto";
import { diffFields, QqAuditService } from "./qq-audit.service";
import { QqAuthService } from "./qq-auth.service";
import { QqCarouselService } from "./qq-carousel.service";
import { QqClientsService } from "./qq-clients.service";
import { QqProductsService } from "./qq-products.service";
import { QqUser } from "./qq.types";

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
  "category",
  "status",
  "imageUrl"
] as const;
const CLIENT_AUDIT_FIELDS = ["name", "email", "phone", "dueDate"] as const;

@Controller("qq")
export class QqController {
  constructor(
    private readonly productsService: QqProductsService,
    private readonly authService: QqAuthService,
    private readonly carouselService: QqCarouselService,
    private readonly clientsService: QqClientsService,
    private readonly auditService: QqAuditService
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
  async getCarouselImage(@Param("id", ParseIntPipe) imageId: number, @Req() req: Request, @Res() res: Response) {
    const image = await this.carouselService.getCarouselImage(imageId);
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

  // Cuenta corriente de clientes (15/09/2026) -- a diferencia de
  // productos/carrusel, esto es SOLO para el admin (email/telefono de
  // clientes reales, nada publico aca).
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
