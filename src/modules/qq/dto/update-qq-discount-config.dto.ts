import { Type } from "class-transformer";
import { IsBoolean, IsInt, IsString, Max, MaxLength, Min } from "class-validator";

// Codigo de descuento (28/09/2026, pedido explicito): un solo codigo
// activo a la vez, porcentaje entero del 1 al 10.
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
}
