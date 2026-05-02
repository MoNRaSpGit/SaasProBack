import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
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

  @Get("products")
  listProducts(@CurrentPosUser() currentUser: PosRequestUser, @Query() query: ListPosProductsDto) {
    return this.posService.listProducts(currentUser, query);
  }

  @Get("products/lookup")
  lookupProduct(@CurrentPosUser() currentUser: PosRequestUser, @Query() query: LookupPosProductDto) {
    return this.posService.lookupProduct(currentUser, query);
  }

  @Post("products")
  createProduct(@CurrentPosUser() currentUser: PosRequestUser, @Body() dto: CreatePosProductDto) {
    return this.posService.createProduct(currentUser, dto);
  }

  @Get("sales")
  listSales(@CurrentPosUser() currentUser: PosRequestUser, @Query() query: ListPosSalesDto) {
    return this.posService.listSales(currentUser, query);
  }

  @Post("sales")
  createSale(@CurrentPosUser() currentUser: PosRequestUser, @Body() dto: CreatePosSaleDto) {
    return this.posService.createSale(currentUser, dto);
  }

  @Get("payments")
  listPayments(@CurrentPosUser() currentUser: PosRequestUser, @Query() query: ListPosPaymentsDto) {
    return this.posService.listPayments(currentUser, query);
  }

  @Post("payments")
  createPayment(@CurrentPosUser() currentUser: PosRequestUser, @Body() dto: CreatePosPaymentDto) {
    return this.posService.createPayment(currentUser, dto);
  }

  @Get("dashboard")
  getDashboard(@CurrentPosUser() currentUser: PosRequestUser, @Query() query: GetPosDashboardDto) {
    return this.posService.getDashboard(currentUser, query);
  }
}
