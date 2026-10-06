import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { ConstruccionService } from "./construccion.service";
import { CreateAnticipoDto } from "./dto/create-anticipo.dto";
import { CreateObraDto } from "./dto/create-obra.dto";
import { CreatePersonalDto } from "./dto/create-personal.dto";
import { SaveAsistenciasDto } from "./dto/save-asistencias.dto";
import { SaveSeguridadDto } from "./dto/save-seguridad.dto";
import { UpdateObraDto } from "./dto/update-obra.dto";
import { UpdatePersonalDto } from "./dto/update-personal.dto";
import { CARGOS, SEGURIDAD_ITEMS } from "./construccion.types";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-\d{2}$/;

// Sin login todavia (mismo criterio aceptado como solucion temporal en
// peluqueria/gym: "mandar algo armado ya" para que el cliente lo vea).
@Controller("construccion")
export class ConstruccionController {
  constructor(private readonly construccionService: ConstruccionService) {}

  @Get("cargos")
  listCargos() {
    return CARGOS;
  }

  @Get("obras")
  listObras() {
    return this.construccionService.listObras();
  }

  @Post("obras")
  createObra(@Body() dto: CreateObraDto) {
    return this.construccionService.createObra(dto);
  }

  @Patch("obras/:id")
  updateObra(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateObraDto) {
    return this.construccionService.updateObra(id, dto);
  }

  @Get("personal")
  listPersonal(@Query("obraId") obraId?: string) {
    const parsedObraId = obraId ? Number(obraId) : undefined;
    return this.construccionService.listPersonal(parsedObraId);
  }

  @Post("personal")
  createPersonal(@Body() dto: CreatePersonalDto) {
    return this.construccionService.createPersonal(dto);
  }

  @Patch("personal/:id")
  updatePersonal(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdatePersonalDto) {
    return this.construccionService.updatePersonal(id, dto);
  }

  @Get("asistencias")
  getAsistencias(@Query("fecha") fecha?: string) {
    if (!fecha || !DATE_PATTERN.test(fecha)) {
      throw new BadRequestException("fecha es obligatoria, formato YYYY-MM-DD");
    }
    return this.construccionService.getAsistenciasByFecha(fecha);
  }

  @Post("asistencias")
  saveAsistencias(@Body() dto: SaveAsistenciasDto) {
    return this.construccionService.saveAsistencias(dto);
  }

  @Get("seguridad-items")
  listSeguridadItems() {
    return SEGURIDAD_ITEMS;
  }

  @Get("seguridad")
  getSeguridad(@Query("fecha") fecha?: string) {
    if (!fecha || !DATE_PATTERN.test(fecha)) {
      throw new BadRequestException("fecha es obligatoria, formato YYYY-MM-DD");
    }
    return this.construccionService.getSeguridadByFecha(fecha);
  }

  @Post("seguridad")
  saveSeguridad(@Body() dto: SaveSeguridadDto) {
    return this.construccionService.saveSeguridad(dto);
  }

  @Get("anticipos")
  listAnticipos(@Query("personalId") personalId?: string) {
    const parsedPersonalId = personalId ? Number(personalId) : undefined;
    return this.construccionService.listAnticipos(parsedPersonalId);
  }

  @Post("anticipos")
  createAnticipo(@Body() dto: CreateAnticipoDto) {
    return this.construccionService.createAnticipo(dto);
  }

  @Get("liquidacion")
  getLiquidacion(@Query("mes") mes?: string) {
    if (!mes || !MONTH_PATTERN.test(mes)) {
      throw new BadRequestException("mes es obligatorio, formato YYYY-MM");
    }
    return this.construccionService.getLiquidacion(mes);
  }
}
