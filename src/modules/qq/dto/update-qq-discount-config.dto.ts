import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from "class-validator";

// Codigo de descuento (28/09/2026, pedido explicito): porcentaje entero del 1 al 10.
// 23/11/2026: ademas del codigo principal, hasta 4 codigos extra (uno por
// vendedor) para saber de quien fue la venta.
export class QqExtraDiscountCodeDto {
  @IsString()
  @MaxLength(40)
  code!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  percentage!: number;
}

export class UpdateQqDiscountConfigDto {
  @IsString()
  @MaxLength(40)
  code!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  percentage!: number;

  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => QqExtraDiscountCodeDto)
  extraCodes?: QqExtraDiscountCodeDto[];
}
