import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { CreateEjemploClientDto } from "./dto/create-ejemplo-client.dto";
import { CreateEjemploProductDto } from "./dto/create-ejemplo-product.dto";
import { CreateEjemploSaleDto } from "./dto/create-ejemplo-sale.dto";
import { SignQzRequestDto } from "./dto/sign-qz-request.dto";
import { UpdateEjemploProductDto } from "./dto/update-ejemplo-product.dto";
import { EjemploClientsService } from "./ejemplo-clients.service";
import { EjemploPrintingService } from "./ejemplo-printing.service";
import { EjemploProductsService } from "./ejemplo-products.service";
import { EjemploSalesService } from "./ejemplo-sales.service";

@Controller("ejemplo")
export class EjemploController {
  constructor(
    private readonly productsService: EjemploProductsService,
    private readonly clientsService: EjemploClientsService,
    private readonly salesService: EjemploSalesService,
    private readonly printingService: EjemploPrintingService
  ) {}

  @Get("rubros")
  listRubros() {
    return this.productsService.listRubros();
  }

  @Get("products")
  listProducts(@Query("rubro") rubro?: string) {
    return this.productsService.listProducts(rubro);
  }

  @Post("products")
  createProduct(@Body() dto: CreateEjemploProductDto) {
    return this.productsService.createProduct(dto);
  }

  @Patch("products/:id")
  updateProduct(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateEjemploProductDto) {
    return this.productsService.updateProduct(id, dto);
  }

  @Delete("products/:id")
  deleteProduct(@Param("id", ParseIntPipe) id: number) {
    return this.productsService.deleteProduct(id);
  }

  @Get("clients")
  listClients() {
    return this.clientsService.listClients();
  }

  @Post("clients")
  createClient(@Body() dto: CreateEjemploClientDto) {
    return this.clientsService.createClient(dto);
  }

  @Delete("clients/:id")
  deleteClient(@Param("id", ParseIntPipe) id: number) {
    return this.clientsService.deleteClient(id);
  }

  @Get("clients/:id/account-entries")
  listAccountEntries(@Param("id", ParseIntPipe) id: number) {
    return this.salesService.listAccountEntries(id);
  }

  @Post("clients/:id/account-entries/settle")
  settleAccountEntries(@Param("id", ParseIntPipe) id: number) {
    return this.salesService.settleAccountEntries(id);
  }

  @Get("sales")
  listSales(@Query("rubro") rubro?: string) {
    return this.salesService.listSales(rubro);
  }

  @Post("sales")
  createSale(@Body() dto: CreateEjemploSaleDto) {
    return this.salesService.createSale(dto);
  }

  @Get("panel/:rubro")
  getPanelSummary(@Param("rubro") rubro: string) {
    return this.salesService.getPanelSummary(rubro);
  }

  // QZ Tray pide el certificado como texto plano (no JSON) via
  // XMLHttpRequest -- ver EjemploPrintingService y frontend-ejemplo
  // services/ejemplo.print.ts.
  @Get("qz-certificate")
  getQzCertificate(@Res() res: Response) {
    res.type("text/plain").send(this.printingService.getQzCertificate());
  }

  @Post("qz-sign")
  signQzRequest(@Body() dto: SignQzRequestDto) {
    return this.printingService.signQzRequest(dto.toSign);
  }
}
