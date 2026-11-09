import { Body, Controller, Get, Param, ParseIntPipe, Post, Put } from "@nestjs/common";
import { CreateSantiClientDto, SetSantiHistoryDto, SetSantiMenuWeekDto, SetSantiWeeklyDto } from "./dto/santi.dto";
import { SantiService } from "./santi.service";

// Demo "Santi" (09/11/2026): cobros, clientes, menu semanal e historial
// de pagos. Todas las rutas devuelven el estado completo para que el
// frontend solo tenga que volver a dibujar.
@Controller("santi")
export class SantiController {
  constructor(private readonly santiService: SantiService) {}

  @Get("state")
  getState() {
    return this.santiService.getState();
  }

  @Post("clients")
  createClient(@Body() dto: CreateSantiClientDto) {
    return this.santiService.createClient(dto.name, dto.address);
  }

  @Post("clients/:id/payments")
  registerPayment(@Param("id", ParseIntPipe) clientId: number) {
    return this.santiService.registerPayment(clientId);
  }

  @Put("clients/:id/weekly")
  setWeekly(@Param("id", ParseIntPipe) clientId: number, @Body() dto: SetSantiWeeklyDto) {
    return this.santiService.setWeekly(clientId, dto.menuId);
  }

  @Put("clients/:id/history/:day")
  setHistory(@Param("id", ParseIntPipe) clientId: number, @Param("day") day: string, @Body() dto: SetSantiHistoryDto) {
    return this.santiService.setHistory(clientId, day, dto.dish);
  }

  @Put("menus/:id/week")
  setMenuInWeek(@Param("id", ParseIntPipe) menuId: number, @Body() dto: SetSantiMenuWeekDto) {
    return this.santiService.setMenuInWeek(menuId, dto.inWeek);
  }

  @Post("reset")
  reset() {
    return this.santiService.reset();
  }
}
