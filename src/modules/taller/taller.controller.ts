import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from "@nestjs/common";
import { CreateTallerQuoteDto } from "./dto/create-taller-quote.dto";
import { CreateTallerStockItemDto } from "./dto/create-taller-stock-item.dto";
import { UpdateTallerStockItemDto } from "./dto/update-taller-stock-item.dto";
import { TallerService } from "./taller.service";

@Controller("taller")
export class TallerController {
  constructor(private readonly tallerService: TallerService) {}

  @Get("stock")
  listStock() {
    return this.tallerService.listStock();
  }

  @Post("stock")
  createStockItem(@Body() dto: CreateTallerStockItemDto) {
    return this.tallerService.createStockItem(dto);
  }

  @Patch("stock/:id")
  updateStockItem(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateTallerStockItemDto) {
    return this.tallerService.updateStockItem(id, dto);
  }

  @Delete("stock/:id")
  deleteStockItem(@Param("id", ParseIntPipe) id: number) {
    return this.tallerService.deleteStockItem(id);
  }

  @Get("quotes")
  listQuotes() {
    return this.tallerService.listQuotes();
  }

  @Post("quotes")
  createQuote(@Body() dto: CreateTallerQuoteDto) {
    return this.tallerService.createQuote(dto);
  }
}
