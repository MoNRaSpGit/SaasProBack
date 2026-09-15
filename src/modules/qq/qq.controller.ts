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
import { CreateQqProductDto } from "./dto/create-qq-product.dto";
import { UploadQqCarouselImageDto } from "./dto/upload-qq-carousel-image.dto";
import { UploadQqProductImageDto } from "./dto/upload-qq-product-image.dto";
import { UpdateQqProductDto } from "./dto/update-qq-product.dto";
import { QqAuthService } from "./qq-auth.service";
import { QqCarouselService } from "./qq-carousel.service";
import { QqProductsService } from "./qq-products.service";

function extractBearerToken(authorization: string | undefined): string | undefined {
  if (!authorization?.startsWith("Bearer ")) return undefined;
  return authorization.slice("Bearer ".length).trim() || undefined;
}

@Controller("qq")
export class QqController {
  constructor(
    private readonly productsService: QqProductsService,
    private readonly authService: QqAuthService,
    private readonly carouselService: QqCarouselService
  ) {}

  // Ver el catalogo es publico -- solo cargar/editar/borrar productos
  // requiere estar logueado como administrador (ver requireAdmin).
  @Get("products")
  listProducts(@Query("search") search?: string) {
    return this.productsService.listProducts(search);
  }

  @Post("products")
  async createProduct(@Headers("authorization") authorization: string | undefined, @Body() dto: CreateQqProductDto) {
    await this.requireAdmin(authorization);
    return this.productsService.createProduct(dto);
  }

  @Patch("products/:id")
  async updateProduct(
    @Headers("authorization") authorization: string | undefined,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateQqProductDto
  ) {
    await this.requireAdmin(authorization);
    return this.productsService.updateProduct(id, dto);
  }

  @Delete("products/:id")
  async deleteProduct(@Headers("authorization") authorization: string | undefined, @Param("id", ParseIntPipe) id: number) {
    await this.requireAdmin(authorization);
    return this.productsService.deleteProduct(id);
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
    await this.requireAdmin(authorization);
    return this.productsService.setProductImage(id, dto.dataUri);
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
    await this.requireAdmin(authorization);
    return this.carouselService.addImage(dto.dataUri);
  }

  @Delete("carousel/:id")
  async deleteCarouselImage(@Headers("authorization") authorization: string | undefined, @Param("id", ParseIntPipe) id: number) {
    await this.requireAdmin(authorization);
    return this.carouselService.deleteImage(id);
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

  private async requireAdmin(authorization: string | undefined) {
    const token = extractBearerToken(authorization);
    const user = await this.authService.getUserForToken(token);
    if (!user) {
      throw new UnauthorizedException("Iniciá sesión para hacer esto");
    }
    if (user.role !== "administrador") {
      throw new ForbiddenException("Solo un administrador puede hacer esto");
    }
  }
}
