import { BadRequestException, Body, Controller, Get, Put, Query } from "@nestjs/common";
import { EmeService } from "./eme.service";

// Demo sin login: sesion unica compartida entre dispositivos.
@Controller("eme")
export class EmeController {
  constructor(private readonly emeService: EmeService) {}

  @Get("state")
  getState(@Query("since") since?: string) {
    const parsed = since !== undefined && since !== "" ? Number(since) : null;
    return this.emeService.getState(parsed !== null && Number.isInteger(parsed) ? parsed : null);
  }

  @Put("state")
  putState(@Body() body: Record<string, unknown>) {
    const baseVersion = Number(body?.baseVersion);
    if (!Number.isInteger(baseVersion) || baseVersion < 0) throw new BadRequestException("baseVersion invalida.");
    return this.emeService.putState(baseVersion, body.state);
  }
}
