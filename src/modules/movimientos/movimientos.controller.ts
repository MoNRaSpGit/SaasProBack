import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { MovimientosAuthGuard } from "./movimientos-auth.guard";
import { MovimientosService } from "./movimientos.service";

@Controller("movimientos")
@UseGuards(MovimientosAuthGuard)
export class MovimientosController {
  constructor(private readonly movimientosService: MovimientosService) {}

  @Get("summary")
  getSummary() {
    return this.movimientosService.getSummary();
  }

  @Get(":appKey/detail")
  getDetail(@Param("appKey") appKey: string) {
    return this.movimientosService.getDetail(appKey);
  }
}
