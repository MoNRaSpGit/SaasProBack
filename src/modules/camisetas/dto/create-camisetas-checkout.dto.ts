import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from "class-validator";

export class CamisetaCheckoutItemDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsInt()
  @Min(1)
  @Max(20)
  quantity!: number;
}

export class CreateCamisetasCheckoutDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CamisetaCheckoutItemDto)
  items!: CamisetaCheckoutItemDto[];

  // Para poder contactar al comprador y coordinar la entrega. Se pide
  // ANTES de ir a Mercado Pago (no hace falta cuenta ni registro).
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  customerName!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(40)
  customerPhone!: string;
}
