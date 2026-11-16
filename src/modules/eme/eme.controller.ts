import { BadRequestException, Body, Controller, Get, Headers, Post, Put, Query } from "@nestjs/common";
import { APP_WIDE_USER, NoticesService } from "../notices/notices.service";
import { TrackEmeActivityDto } from "./dto/track-eme-activity.dto";
import { EmeService } from "./eme.service";

// Demo sin login: sesion unica compartida entre dispositivos.
@Controller("eme")
export class EmeController {
  constructor(
    private readonly emeService: EmeService,
    private readonly noticesService: NoticesService
  ) {}

  // Aviso de demora activado desde Scrum (aplica a toda la app: no hay login).
  @Get("notice")
  async getNotice() {
    return { active: await this.noticesService.isActiveFor("eme", APP_WIDE_USER) };
  }

  @Post("notice/seen")
  async noticeSeen() {
    await this.noticesService.markSeen("eme", APP_WIDE_USER);
    return { ok: true };
  }

  @Get("state")
  getState(@Query("since") since?: string) {
    const parsed = since !== undefined && since !== "" ? Number(since) : null;
    return this.emeService.getState(parsed !== null && Number.isInteger(parsed) ? parsed : null);
  }

  // Registro interno de uso (se ve en la app de Movimientos).
  @Post("activity")
  async trackActivity(@Body() dto: TrackEmeActivityDto, @Headers("user-agent") userAgent?: string) {
    await this.emeService.trackActivity(dto, userAgent);
    return { ok: true };
  }

  @Put("state")
  putState(@Body() body: Record<string, unknown>) {
    const baseVersion = Number(body?.baseVersion);
    if (!Number.isInteger(baseVersion) || baseVersion < 0) throw new BadRequestException("baseVersion invalida.");
    return this.emeService.putState(baseVersion, body.state);
  }
}
