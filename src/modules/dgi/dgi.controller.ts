import { Body, Controller, Get, Post } from "@nestjs/common";
import { CreateDgiComprobanteDto } from "./dto/create-dgi-comprobante.dto";
import { DgiService } from "./dgi.service";

@Controller("dgi")
export class DgiController {
  constructor(private readonly dgiService: DgiService) {}

  // Solo confirma que las credenciales de FEU andan (token OK). Util para
  // el primer chequeo: "la API me manda un 200?".
  @Get("ping")
  ping() {
    return this.dgiService.pingSandbox();
  }

  @Post("comprobantes")
  createComprobante(@Body() dto: CreateDgiComprobanteDto) {
    return this.dgiService.createComprobante(dto);
  }
}
