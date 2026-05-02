import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { CapabilityGuard } from "../../shared/authz/capability.guard";
import { RequireCapability } from "../../shared/authz/require-capability.decorator";
import { CurrentPosUser } from "./current-pos-user.decorator";
import { CreatePosPaymentDto } from "./dto/create-pos-payment.dto";
import { CreatePosProductDto } from "./dto/create-pos-product.dto";
import { CreatePosSaleDto } from "./dto/create-pos-sale.dto";
import { GetPosDashboardDto } from "./dto/get-pos-dashboard.dto";
import { ListPosPaymentsDto } from "./dto/list-pos-payments.dto";
import { ListPosProductsDto } from "./dto/list-pos-products.dto";
import { ListPosSalesDto } from "./dto/list-pos-sales.dto";
import { LookupPosProductDto } from "./dto/lookup-pos-product.dto";
import { PosAuthGuard } from "./pos-auth.guard";
import { PosService } from "./pos.service";
import { PosRequestUser } from "./pos.types";

@Controller("pos")
@UseGuards(PosAuthGuard)
export class PosController {
  constructor(private readonly posService: PosService) {}

  @RequireCapability("pos.products.read")
  @UseGuards(CapabilityGuard)
  @Get("products")
  listProducts(@CurrentPosUser() currentUser: PosRequestUser, @Query() query: ListPosProductsDto) {
    return this.posService.listProducts(currentUser, query);
  }

  @RequireCapability("pos.products.read")
  @UseGuards(CapabilityGuard)
  @Get("products/lookup")
  lookupProduct(@CurrentPosUser() currentUser: PosRequestUser, @Query() query: LookupPosProductDto) {
    return this.posService.lookupProduct(currentUser, query);
  }

  @RequireCapability("pos.products.write")
  @UseGuards(CapabilityGuard)
  @Post("products")
  createProduct(@CurrentPosUser() currentUser: PosRequestUser, @Body() dto: CreatePosProductDto) {
    return this.posService.createProduct(currentUser, dto);
  }

  @RequireCapability("pos.sales.read")
  @UseGuards(CapabilityGuard)
  @Get("sales")
  listSales(@CurrentPosUser() currentUser: PosRequestUser, @Query() query: ListPosSalesDto) {
    return this.posService.listSales(currentUser, query);
  }

  @RequireCapability("pos.sales.write")
  @UseGuards(CapabilityGuard)
  @Post("sales")
  createSale(@CurrentPosUser() currentUser: PosRequestUser, @Body() dto: CreatePosSaleDto) {
    return this.posService.createSale(currentUser, dto);
  }

  @RequireCapability("pos.payments.read")
  @UseGuards(CapabilityGuard)
  @Get("payments")
  listPayments(@CurrentPosUser() currentUser: PosRequestUser, @Query() query: ListPosPaymentsDto) {
    return this.posService.listPayments(currentUser, query);
  }

  @RequireCapability("pos.payments.write")
  @UseGuards(CapabilityGuard)
  @Post("payments")
  createPayment(@CurrentPosUser() currentUser: PosRequestUser, @Body() dto: CreatePosPaymentDto) {
    return this.posService.createPayment(currentUser, dto);
  }

  @RequireCapability("pos.dashboard.read")
  @UseGuards(CapabilityGuard)
  @Get("dashboard")
  getDashboard(@CurrentPosUser() currentUser: PosRequestUser, @Query() query: GetPosDashboardDto) {
    return this.posService.getDashboard(currentUser, query);
  }
}
