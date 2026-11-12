import { IsIn, IsOptional, IsString, Matches, MaxLength } from "class-validator";

export const EME_ACTIVITY_EVENTS = ["entrada", "login", "logout", "seccion", "accion"] as const;

export class TrackEmeActivityDto {
  // Lo genera el navegador solo (no hay login): letras, numeros y guiones.
  @IsString()
  @Matches(/^[A-Za-z0-9-]{8,40}$/)
  visitorId!: string;

  @IsIn(EME_ACTIVITY_EVENTS)
  event!: (typeof EME_ACTIVITY_EVENTS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  detail?: string;
}
