import { IsIn, IsOptional, IsString, Matches, MaxLength } from "class-validator";

// Contador propio de visitas de frontend-logiclab (02/11/2026, pedido
// explicito: reemplazar GoatCounter porque el usuario no quiere cuentas
// externas). Sin cookies: visitorId es un id al azar que vive solo
// mientras la pagina esta abierta (ver script.js del sitio).
export const LOGICLAB_TRACK_EVENTS = ["visit", "ver_video", "wa_click", "cotizador_abrir", "cotizador_enviar"] as const;
export type LogiclabTrackEvent = (typeof LOGICLAB_TRACK_EVENTS)[number];

export class TrackLogiclabEventDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9-]{6,40}$/)
  visitorId!: string;

  @IsIn(LOGICLAB_TRACK_EVENTS as unknown as string[])
  event!: LogiclabTrackEvent;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  rubro?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  section?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  plan?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  src?: string;
}
