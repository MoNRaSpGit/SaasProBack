import { Body, Controller, Headers, HttpCode, Post } from "@nestjs/common";
import { TrackTamboActivityDto } from "./dto/track-tambo-activity.dto";
import { TamboService } from "./tambo.service";

@Controller("tambo")
export class TamboController {
  constructor(private readonly tamboService: TamboService) {}

  // La app avisa sola cuando alguien ingresa, cambia de pestaña o guarda
  // algo. No devuelve nada.
  @Post("activity")
  @HttpCode(204)
  async trackActivity(@Body() dto: TrackTamboActivityDto, @Headers("user-agent") userAgent?: string) {
    await this.tamboService.trackActivity(dto, userAgent);
  }
}
