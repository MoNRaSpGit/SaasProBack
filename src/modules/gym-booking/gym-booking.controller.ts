import { Body, Controller, Delete, Get, Headers, HttpCode, HttpException, HttpStatus, Param, ParseIntPipe, Post, Query, Req } from "@nestjs/common";
import { Request } from "express";
import { GymAuthService } from "../gym/gym-auth.service";
import { CancelGymBookingDto, CreateGymBookingDto } from "./dto/gym-booking.dto";
import { GymBookingService } from "./gym-booking.service";

// Freno simple contra spam en los endpoints publicos que escriben. Generoso a
// proposito: un gym entero puede compartir el mismo wifi (misma IP).
const WRITE_LIMIT = 60;
const WRITE_WINDOW_MS = 10 * 60 * 1000;
const writeBuckets = new Map<string, { count: number; resetAt: number }>();

function checkWriteLimit(request: Request) {
  const now = Date.now();
  for (const [key, bucket] of writeBuckets) if (bucket.resetAt <= now) writeBuckets.delete(key);
  const forwarded = request.headers["x-forwarded-for"];
  const ip = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : request.ip || "?";
  const bucket = writeBuckets.get(ip);
  if (!bucket) {
    writeBuckets.set(ip, { count: 1, resetAt: now + WRITE_WINDOW_MS });
    return;
  }
  if (bucket.count >= WRITE_LIMIT) throw new HttpException("Demasiados intentos. Probá en unos minutos.", HttpStatus.TOO_MANY_REQUESTS);
  bucket.count += 1;
}

// Turnos del gym (reservas por link publico). Publico = con el token del link.
@Controller("gym-booking")
export class GymBookingController {
  constructor(
    private readonly bookingService: GymBookingService,
    private readonly gymAuthService: GymAuthService
  ) {}

  @Get("public/:token")
  getSchedule(@Param("token") token: string, @Query("date") date?: string) {
    return this.bookingService.getPublicSchedule(token, date);
  }

  @HttpCode(HttpStatus.OK)
  @Post("public/:token/book")
  book(@Param("token") token: string, @Body() dto: CreateGymBookingDto, @Req() request: Request) {
    checkWriteLimit(request);
    return this.bookingService.book(token, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post("public/:token/cancel")
  cancel(@Param("token") token: string, @Body() dto: CancelGymBookingDto, @Req() request: Request) {
    checkWriteLimit(request);
    return this.bookingService.cancel(token, dto);
  }

  @Get("admin")
  async adminDay(@Headers("authorization") authorization: string | undefined, @Query("date") date?: string) {
    const user = await this.gymAuthService.requireUser(authorization);
    return this.bookingService.getAdminDay(user.workspaceKey, date);
  }

  @Delete("admin/:id")
  async adminDelete(@Headers("authorization") authorization: string | undefined, @Param("id", ParseIntPipe) id: number) {
    const user = await this.gymAuthService.requireUser(authorization);
    return this.bookingService.adminDelete(user.workspaceKey, id);
  }
}
