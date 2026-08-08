import { IsIn, IsNumber, IsOptional, IsPositive, IsString, MaxLength, MinLength, ValidateIf } from "class-validator";
import { CAMISETA_CATEGORIES } from "../camisetas.types";

export class UpdateCamisetasProductDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  price?: number;

  // Precio de oferta. Mandar null saca la oferta (vuelve al precio normal).
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber()
  @IsPositive()
  salePrice?: number | null;

  @IsOptional()
  @IsIn(CAMISETA_CATEGORIES)
  category?: string;
}
