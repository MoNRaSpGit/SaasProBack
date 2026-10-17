import { BadRequestException, Controller, Get, Param, Query } from "@nestjs/common";
import { isValidDayLabel } from "./movimientos.dateUtils";
import { MovimientosService } from "./movimientos.service";

@Controller("movimientos")
export class MovimientosController {
  constructor(private readonly movimientosService: MovimientosService) {}

  @Get("summary")
  getSummary() {
    return this.movimientosService.getSummary();
  }

  @Get(":appKey/detail")
  getDetail(@Param("appKey") appKey: string, @Query("date") date?: string) {
    if (date && !isValidDayLabel(date)) {
      throw new BadRequestException("Fecha invalida, se espera YYYY-MM-DD.");
    }
    return this.movimientosService.getDetail(appKey, date);
  }
}
