import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested
} from "class-validator";

export class CreateJokerOrderItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  productId!: number;

  @IsString()
  @MaxLength(180)
  productName!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  detail?: string;
}

export class CreateJokerOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateJokerOrderItemDto)
  items!: CreateJokerOrderItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  // Nota general del pedido (ej. "Pedido para las 9:30"), distinta del
  // detalle por producto (item.detail). Antes solo se usaba para el
  // ticket impreso al toque y se perdia -- ahora se guarda para que
  // sobreviva hasta que se acepte un pedido pendiente y se reimprima ahi.
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;

  @IsOptional()
  @IsIn(["efectivo", "tarjeta", "transferencia", "cuenta"])
  paymentMethod?: "efectivo" | "tarjeta" | "transferencia" | "cuenta";

  // Quien pago: el nombre del cliente elegido (cuenta) o el que se tipeo a
  // mano (transferencia), para poder rastrear el pago despues en el panel.
  @IsOptional()
  @IsString()
  @MaxLength(160)
  customerName?: string;

  // Cliente elegido cuando se paga "a cuenta" -- se guarda ademas del
  // nombre libre para poder generar el movimiento de cuenta corriente
  // recien al aceptar un pedido pendiente (ver JokerOrdersService#acceptOrder).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  clientId?: number;

  // Fecha "logica" del pedido (YYYY-MM-DD), para cargar a mano pedidos a
  // cuenta que se olvidaron y se ingresan varios dias despues. Si no se
  // manda, se usa la fecha real de carga (created_at) como siempre.
  @IsOptional()
  @Matches(/^(\d{4}-\d{2}-\d{2})?$/)
  orderDate?: string;

  // Repartidor asignado y cuanto se le paga por el envio de este pedido en
  // particular (se suma despues en la liquidacion del delivery).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  courierId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  deliveryCost?: number;

  // Pedido de mostrador armado por el rol "Usuario": queda en espera hasta
  // que el Administrador lo acepte (le asigna numero de cocina real recien
  // ahi) o lo rechace. Sin esto (o en false) se crea confirmado al toque,
  // como cualquier pedido de siempre.
  @IsOptional()
  pending?: boolean;
}
