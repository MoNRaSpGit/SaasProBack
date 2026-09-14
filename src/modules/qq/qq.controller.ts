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
  UnauthorizedException
} from "@nestjs/common";
import { CreateQqProductDto } from "./dto/create-qq-product.dto";
import { UpdateQqProductDto } from "./dto/update-qq-product.dto";
import { QqAuthService } from "./qq-auth.service";
import { QqProductsService } from "./qq-products.service";

function extractBearerToken(authorization: string | undefined): string | undefined {
  if (!authorization?.startsWith("Bearer ")) return undefined;
  return authorization.slice("Bearer ".length).trim() || undefined;
}

@Controller("qq")
export class QqController {
  constructor(
    private readonly productsService: QqProductsService,
    private readonly authService: QqAuthService
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
