import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from "class-validator";

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
}
