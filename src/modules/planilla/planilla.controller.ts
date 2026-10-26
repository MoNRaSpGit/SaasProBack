import { Controller, Get } from "@nestjs/common";
import { PlanillaService } from "./planilla.service";

@Controller("planilla")
export class PlanillaController {
  constructor(private readonly planillaService: PlanillaService) {}

  // Cuadros y jugadores para elegir Local / Visitante en la planilla.
  @Get("catalog")
  getCatalog() {
    return this.planillaService.getCatalog();
  }
}
