import { BadRequestException, Body, Controller, Get, Post, Query } from "@nestjs/common";
import { PeluqueriaPushEndpointDto, PeluqueriaPushSubscriptionDto } from "./dto/push-subscription.dto";
import { PeluqueriaPushService } from "./peluqueria-push.service";
import { CreatePeluqueriaReservationDto } from "./dto/create-peluqueria-reservation.dto";
import { PeluqueriaService } from "./peluqueria.service";
import { PELUQUEROS } from "./peluqueria.types";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Sin login, pedido explicito (01/10/2026): "solo entran, ven las horas
// disponibles y le hacen click... no se tenga que loguear". /reservations
// (GET completo) es la unica forma que va a tener el dueno de ver quien
// reservo mientras no haya un /admin con login -- cualquiera con el link
// la puede ver, igual que se acepto como solucion temporal en gym.
@Controller("peluqueria")
export class PeluqueriaController {
  constructor(
    private readonly peluqueriaService: PeluqueriaService,
    private readonly pushService: PeluqueriaPushService
  ) {}

  @Get("peluqueros")
  listPeluqueros() {
    return PELUQUEROS;
  }

  @Get("busy-slots")
  getBusySlots(@Query("peluquero") peluquero?: string, @Query("from") from?: string, @Query("to") to?: string) {
    if (!peluquero || !(PELUQUEROS as readonly string[]).includes(peluquero)) {
      throw new BadRequestException("peluquero es obligatorio y tiene que ser uno de los habilitados");
    }
    if (!from || !to || !DATE_PATTERN.test(from) || !DATE_PATTERN.test(to)) {
      throw new BadRequestException("from/to son obligatorios, formato YYYY-MM-DD");
    }
    return this.peluqueriaService.getBusySlots(peluquero, from, to);
  }

  @Get("reservations")
  listReservations() {
    return this.peluqueriaService.listReservations();
  }

  // Avisos push al celular del dueño (17/11/2026, version de demostracion sin
  // login: cualquier celular puede suscribirse desde el panel).
  @Get("push/public-key")
  getPushPublicKey() {
    return this.pushService.getPublicKey();
  }

  @Post("push/subscribe")
  subscribePush(@Body() dto: PeluqueriaPushSubscriptionDto) {
    return this.pushService.subscribe(dto.endpoint, dto.keys.p256dh, dto.keys.auth);
  }

  @Post("push/unsubscribe")
  unsubscribePush(@Body() dto: PeluqueriaPushEndpointDto) {
    return this.pushService.unsubscribe(dto.endpoint);
  }

  // Prueba: solo se la manda al celular que la pide.
  @Post("push/test")
  async testPush(@Body() dto: PeluqueriaPushEndpointDto) {
    const ok = await this.pushService.notifyOne(dto.endpoint, {
      title: "Avisos activados ✅",
      body: "Así te va a llegar cada reserva nueva.",
      url: "#admin"
    });
    return { ok };
  }

  @Post("reservations")
  createReservation(@Body() dto: CreatePeluqueriaReservationDto) {
    return this.peluqueriaService.createReservation(dto);
  }
}
