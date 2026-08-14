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

  @IsOptional()
  @IsIn(["efectivo", "tarjeta", "transferencia", "cuenta"])
  paymentMethod?: "efectivo" | "tarjeta" | "transferencia" | "cuenta";

  // Quien pago: el nombre del cliente elegido (cuenta) o el que se tipeo a
  // mano (transferencia), para poder rastrear el pago despues en el panel.
  @IsOptional()
  @IsString()
  @MaxLength(160)
  customerName?: string;

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
}
