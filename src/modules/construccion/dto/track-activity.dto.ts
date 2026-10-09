import { IsIn, IsOptional, IsString, Matches, MaxLength } from "class-validator";
import { ACTIVITY_EVENTS } from "../construccion.types";

export class TrackActivityDto {
  // Lo genera el navegador solo (no hay login): letras, numeros y guiones.
  @IsString()
  @Matches(/^[A-Za-z0-9-]{8,40}$/)
  visitorId!: string;

  @IsIn(ACTIVITY_EVENTS)
  event!: (typeof ACTIVITY_EVENTS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  detail?: string;
}
