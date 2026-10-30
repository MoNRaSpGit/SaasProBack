import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from "class-validator";

// Eventos de visitantes (30/10/2026, pedido explicito): contador de visitas
// y recorrido (que tarjeta abren, si agregan al carrito, si van a WhatsApp).
// Sin cookies: visitorId es un numero al azar que vive solo mientras la
// pagina esta abierta (no se guarda en el telefono del visitante).
export const QQ_TRACK_EVENTS = ["visit", "view_product", "add_to_cart", "open_cart", "whatsapp_click"] as const;
export type QqTrackEvent = (typeof QQ_TRACK_EVENTS)[number];

export class TrackQqEventDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9-]{6,40}$/)
  visitorId!: string;

  @IsIn(QQ_TRACK_EVENTS as unknown as string[])
  event!: QqTrackEvent;

  @IsOptional()
  @IsInt()
  @Min(1)
  productId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;
}
