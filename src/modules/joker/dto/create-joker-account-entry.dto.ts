import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from "class-validator";

export class CreateJokerAccountEntryItemDto {
  @IsString()
  @MaxLength(180)
  productName!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice!: number;
}

export class CreateJokerAccountEntryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  clientId!: number;

  // Pedido que genero este movimiento (si vino de una venta "a cuenta" desde
  // la pantalla de pedidos), para poder sincronizarlo despues si se edita.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  orderId?: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  total!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateJokerAccountEntryItemDto)
  items!: CreateJokerAccountEntryItemDto[];
}
