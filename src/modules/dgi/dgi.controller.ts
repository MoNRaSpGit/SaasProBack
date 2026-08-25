import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { CreateDgiComprobanteDto } from "./dto/create-dgi-comprobante.dto";
import { DgiService } from "./dgi.service";
import { DgiFeuPdfFormat } from "./dgi.types";

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

  // FEU devuelve el PDF envuelto en JSON (base64); acá lo desempaquetamos
  // para que el frontend pueda simplemente abrir esta URL o embeberla en un
  // iframe/ventana de impresion, sin manejar base64 en el cliente.
  @Get("comprobantes/:id/pdf")
  async getComprobantePdf(
    @Param("id", ParseIntPipe) id: number,
    @Query("tipo") tipo: string | undefined,
    @Res() res: Response
  ) {
    const formato: DgiFeuPdfFormat = tipo === "A4" ? "A4" : "ticket80";
    const pdf = await this.dgiService.getComprobantePdf(id, formato);
    const buffer = Buffer.from(pdf.data, "base64");

    res.setHeader("Content-Type", pdf.mime_type || "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${pdf.file_name}"`);
    res.send(buffer);
  }
}
