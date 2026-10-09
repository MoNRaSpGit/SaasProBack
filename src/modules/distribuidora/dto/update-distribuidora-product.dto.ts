import { Type } from "class-transformer";
import { IsBoolean, IsNumber, IsOptional, IsPositive, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateDistribuidoraProductDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price?: number;

  // false = dado de baja: deja de salirle al vendedor, pero no se borra
  // (los pedidos viejos lo siguen nombrando).
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
