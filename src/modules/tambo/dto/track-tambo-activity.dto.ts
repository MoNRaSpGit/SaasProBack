import { IsIn, IsOptional, IsString, Matches, MaxLength } from "class-validator";

export const TAMBO_ACTIVITY_EVENTS = ["login", "logout", "seccion", "accion"] as const;
export const TAMBO_ROLES = ["cliente", "logiclab"] as const;

export class TrackTamboActivityDto {
  // Lo genera el navegador solo (no hay usuario): letras, numeros y guiones.
  @IsString()
  @Matches(/^[A-Za-z0-9-]{8,40}$/)
  visitorId!: string;

  // "cliente" = entro con el boton Ingresar; "logiclab" = nosotros (5
  // toques al logo).
  @IsIn(TAMBO_ROLES)
  role!: (typeof TAMBO_ROLES)[number];

  @IsIn(TAMBO_ACTIVITY_EVENTS)
  event!: (typeof TAMBO_ACTIVITY_EVENTS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  detail?: string;
}
