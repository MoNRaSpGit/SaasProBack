import { Body, Controller, HttpCode, HttpStatus, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { TrackLogiclabEventDto } from "./dto/track-logiclab-event.dto";
import { LogiclabVisitsService } from "./logiclab-visits.service";

// Igual tope que frontend-qq (ver qq.controller.ts): publico y sin login,
// asi que se topea por IP para que nadie pueda llenar la tabla.
const TRACK_LIMIT = 300;
const TRACK_WINDOW_MS = 60 * 60 * 1000;
const trackEventsByIp = new Map<string, number[]>();

function isTrackAllowed(ip: string): boolean {
  const now = Date.now();
  const recent = (trackEventsByIp.get(ip) ?? []).filter((timestamp) => now - timestamp < TRACK_WINDOW_MS);
  if (recent.length >= TRACK_LIMIT) {
    trackEventsByIp.set(ip, recent);
    return false;
  }
  recent.push(now);
  trackEventsByIp.set(ip, recent);
  if (trackEventsByIp.size > 2000) {
    for (const [key, timestamps] of trackEventsByIp) {
      if (timestamps.every((timestamp) => now - timestamp >= TRACK_WINDOW_MS)) trackEventsByIp.delete(key);
    }
  }
  return true;
}

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
  return first || req.ip || "desconocida";
}

@Controller("logiclab")
export class LogiclabController {
  constructor(private readonly visitsService: LogiclabVisitsService) {}

  // Siempre 200, igual que el de qq: nunca puede molestar al visitante de
  // la landing ni hacer que la pagina muestre un error por esto.
  @HttpCode(HttpStatus.OK)
  @Post("events/track")
  async trackEvent(@Req() req: Request, @Body() dto: TrackLogiclabEventDto) {
    const ip = getClientIp(req);
    if (isTrackAllowed(ip)) {
      await this.visitsService.record(dto, ip);
    }
    return { ok: true };
  }
}
