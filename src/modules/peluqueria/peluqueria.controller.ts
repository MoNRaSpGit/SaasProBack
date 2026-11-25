import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException
} from "@nestjs/common";
import type { Request } from "express";
import { CreatePeluqueriaReservationDto } from "./dto/create-peluqueria-reservation.dto";
import { CreatePeluqueriaBarberDto, UpdatePeluqueriaBarberDto } from "./dto/peluqueria-barber.dto";
import { SavePeluqueriaScheduleDto } from "./dto/save-peluqueria-schedule.dto";
import { LoginPeluqueriaOwnerDto } from "./dto/login-peluqueria-owner.dto";
import { PeluqueriaAuthService } from "./peluqueria-auth.service";
import { PeluqueriaService } from "./peluqueria.service";
import { PeluqueriaOwner } from "./peluqueria.types";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function extractBearerToken(authorization: string | undefined): string | undefined {
  if (!authorization?.startsWith("Bearer ")) return undefined;
  return authorization.slice("Bearer ".length).trim() || undefined;
}

// Tope de intentos fallidos de login por IP (en memoria, alcanza para frenar
// que alguien pruebe contraseñas sin parar).
const LOGIN_FAIL_LIMIT = 10;
const LOGIN_FAIL_WINDOW_MS = 15 * 60 * 1000;
const loginFailsByIp = new Map<string, number[]>();

function recentFails(ip: string): number[] {
  const now = Date.now();
  const recent = (loginFailsByIp.get(ip) ?? []).filter((timestamp) => now - timestamp < LOGIN_FAIL_WINDOW_MS);
  loginFailsByIp.set(ip, recent);
  if (loginFailsByIp.size > 2000) {
    for (const [key, list] of loginFailsByIp) {
      if (list.every((timestamp) => now - timestamp >= LOGIN_FAIL_WINDOW_MS)) loginFailsByIp.delete(key);
    }
  }
  return recent;
}

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
  return first || req.ip || "desconocida";
}

// Peluqueria multi-local (17/11/2026). Lo publico (ver horarios y reservar) va
// siempre colgado del link del local (/salons/:slug/...); lo del dueño exige
// su login y solo muestra las reservas de SU peluqueria.
@Controller("peluqueria")
export class PeluqueriaController {
  constructor(
    private readonly peluqueriaService: PeluqueriaService,
    private readonly authService: PeluqueriaAuthService
  ) {}

  @Get("salons/:slug")
  getSalon(@Param("slug") slug: string) {
    return this.peluqueriaService.getPublicSalon(slug);
  }

  @Get("salons/:slug/busy-slots")
  getBusySlots(
    @Param("slug") slug: string,
    @Query("barberId", ParseIntPipe) barberId: number,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    if (!from || !to || !DATE_PATTERN.test(from) || !DATE_PATTERN.test(to)) {
      throw new BadRequestException("from/to son obligatorios, formato YYYY-MM-DD");
    }
    return this.peluqueriaService.getBusySlots(slug, barberId, from, to);
  }

  @Post("salons/:slug/reservations")
  createReservation(@Param("slug") slug: string, @Body() dto: CreatePeluqueriaReservationDto) {
    return this.peluqueriaService.createReservation(slug, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post("auth/login")
  async login(@Req() req: Request, @Body() dto: LoginPeluqueriaOwnerDto) {
    const ip = getClientIp(req);
    if (recentFails(ip).length >= LOGIN_FAIL_LIMIT) {
      throw new HttpException("Demasiados intentos. Probá de nuevo en unos minutos.", HttpStatus.TOO_MANY_REQUESTS);
    }
    try {
      return await this.authService.login(dto);
    } catch (error) {
      if (error instanceof UnauthorizedException) recentFails(ip).push(Date.now());
      throw error;
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post("auth/logout")
  async logout(@Headers("authorization") authorization: string | undefined) {
    const token = extractBearerToken(authorization);
    if (token) await this.authService.logout(token);
    return { ok: true };
  }

  @Get("auth/me")
  async me(@Headers("authorization") authorization: string | undefined) {
    return { user: await this.requireOwner(authorization) };
  }

  @Get("admin/reservations")
  async listReservations(@Headers("authorization") authorization: string | undefined) {
    const owner = await this.requireOwner(authorization);
    return this.peluqueriaService.listReservations(owner.salonId);
  }

  @Get("admin/settings")
  async getSettings(@Headers("authorization") authorization: string | undefined) {
    const owner = await this.requireOwner(authorization);
    return this.peluqueriaService.getAdminSettings(owner.salonId);
  }

  @Put("admin/schedule")
  async saveSchedule(@Headers("authorization") authorization: string | undefined, @Body() dto: SavePeluqueriaScheduleDto) {
    const owner = await this.requireOwner(authorization);
    return this.peluqueriaService.saveSchedule(owner.salonId, dto);
  }

  @Post("admin/barbers")
  async addBarber(@Headers("authorization") authorization: string | undefined, @Body() dto: CreatePeluqueriaBarberDto) {
    const owner = await this.requireOwner(authorization);
    return this.peluqueriaService.addBarber(owner.salonId, dto.name);
  }

  @Patch("admin/barbers/:id")
  async updateBarber(
    @Headers("authorization") authorization: string | undefined,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdatePeluqueriaBarberDto
  ) {
    const owner = await this.requireOwner(authorization);
    return this.peluqueriaService.updateBarber(owner.salonId, id, dto);
  }

  private async requireOwner(authorization: string | undefined): Promise<PeluqueriaOwner> {
    const owner = await this.authService.getOwnerForToken(extractBearerToken(authorization));
    if (!owner) throw new UnauthorizedException("Iniciá sesión para entrar al panel");
    return owner;
  }
}
