import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CapabilityGuard } from "../../shared/authz/capability.guard";
import { RequireCapability } from "../../shared/authz/require-capability.decorator";
import { AlamcenAuthGuard } from "./alamcen-auth.guard";
import { CurrentAlamcenUser } from "./current-alamcen-user.decorator";
import { AlamcenService } from "./alamcen.service";
import { CreateManualProductDto } from "./dto/create-manual-product.dto";
import { CreateAlamcenPaymentDto } from "./dto/create-payment.dto";
import { CreateAlamcenSaleDto } from "./dto/create-sale.dto";
import { GetAlamcenDashboardDto } from "./dto/get-dashboard.dto";
import { ListAlamcenProductsDto } from "./dto/list-products.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { AlamcenRequestUser } from "./alamcen.types";

@Controller("alamcen")
@UseGuards(AlamcenAuthGuard)
export class AlamcenController {
  constructor(private readonly alamcenService: AlamcenService) {}

  @RequireCapability("alamcen.shell.read")
  @UseGuards(CapabilityGuard)
  @Get("status")
  getStatus(@CurrentAlamcenUser() currentUser: AlamcenRequestUser) {
    return this.alamcenService.getStatus(currentUser);
  }

  @RequireCapability("alamcen.products.read")
  @UseGuards(CapabilityGuard)
  @Get("products")
  listProducts(@CurrentAlamcenUser() currentUser: AlamcenRequestUser, @Query() query: ListAlamcenProductsDto) {
    return this.alamcenService.listProducts(currentUser, query);
  }

  @RequireCapability("alamcen.products.read")
  @UseGuards(CapabilityGuard)
  @Get("productos/barcode/:barcode")
  getProductByBarcode(@CurrentAlamcenUser() currentUser: AlamcenRequestUser, @Param("barcode") barcode: string) {
    return this.alamcenService.getProductByBarcode(currentUser, barcode);
  }

  @RequireCapability("alamcen.products.write")
  @UseGuards(CapabilityGuard)
  @Post("productos/manual")
  createManualProduct(@CurrentAlamcenUser() currentUser: AlamcenRequestUser, @Body() payload: CreateManualProductDto) {
    return this.alamcenService.createManualProduct(currentUser, payload);
  }

  @RequireCapability("alamcen.products.write")
  @UseGuards(CapabilityGuard)
  @Patch("productos/:productId")
  updateProduct(
    @CurrentAlamcenUser() currentUser: AlamcenRequestUser,
    @Param("productId") productId: string,
    @Body() payload: UpdateProductDto
  ) {
    return this.alamcenService.updateProduct(currentUser, Number(productId), payload);
  }

  @RequireCapability("alamcen.sales.write")
  @UseGuards(CapabilityGuard)
  @Post("sales")
  createSale(@CurrentAlamcenUser() currentUser: AlamcenRequestUser, @Body() payload: CreateAlamcenSaleDto) {
    return this.alamcenService.createSale(currentUser, payload);
  }

  @RequireCapability("alamcen.payments.write")
  @UseGuards(CapabilityGuard)
  @Post("payments")
  createPayment(@CurrentAlamcenUser() currentUser: AlamcenRequestUser, @Body() payload: CreateAlamcenPaymentDto) {
    return this.alamcenService.createPayment(currentUser, payload);
  }

  @RequireCapability("alamcen.dashboard.read")
  @UseGuards(CapabilityGuard)
  @Get("dashboard")
  getDashboard(@CurrentAlamcenUser() currentUser: AlamcenRequestUser, @Query() query: GetAlamcenDashboardDto) {
    return this.alamcenService.getDashboard(currentUser, query);
  }
}
