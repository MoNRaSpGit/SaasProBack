import { BadRequestException, Body, Controller, Get, Post, Query } from "@nestjs/common";
import { CreatePeluqueriaReservationDto } from "./dto/create-peluqueria-reservation.dto";
import { PeluqueriaService } from "./peluqueria.service";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Sin login, pedido explicito (01/10/2026): "solo entran, ven las horas
// disponibles y le hacen click... no se tenga que loguear". /reservations
// (GET completo) es la unica forma que va a tener el dueno de ver quien
// reservo mientras no haya un /admin con login -- cualquiera con el link
// la puede ver, igual que se acepto como solucion temporal en gym.
@Controller("peluqueria")
export class PeluqueriaController {
  constructor(private readonly peluqueriaService: PeluqueriaService) {}

  @Get("busy-slots")
  getBusySlots(@Query("from") from?: string, @Query("to") to?: string) {
    if (!from || !to || !DATE_PATTERN.test(from) || !DATE_PATTERN.test(to)) {
      throw new BadRequestException("from/to son obligatorios, formato YYYY-MM-DD");
    }
    return this.peluqueriaService.getBusySlots(from, to);
  }

  @Get("reservations")
  listReservations() {
    return this.peluqueriaService.listReservations();
  }

  @Post("reservations")
  createReservation(@Body() dto: CreatePeluqueriaReservationDto) {
    return this.peluqueriaService.createReservation(dto);
  }
}
