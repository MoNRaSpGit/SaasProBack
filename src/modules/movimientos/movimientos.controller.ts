import { Controller, Get, Param } from "@nestjs/common";
import { MovimientosService } from "./movimientos.service";

@Controller("movimientos")
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
