import { Type } from "class-transformer";
import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";

export class CreateJokerProductDto {
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  name!: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  subcategory?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  subcategoryDetail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string;

  @IsOptional()
  @IsString()
  ingredients?: string;

  @IsOptional()
  @IsString()
  observations?: string;

  @IsOptional()
  @IsIn(["simple", "extra"])
  productType?: "simple" | "extra";

  @IsOptional()
  @IsIn(["draft", "published"])
  status?: "draft" | "published";

  @IsOptional()
  @IsIn(["unidad", "kg"])
  pricingUnit?: "unidad" | "kg";

  // Solo para productos "autonomos" (ej: alcohol en gel, una gaseosa
  // comprada ya lista) que no comparten insumos con nada mas: crea de
  // una un insumo propio con esta cantidad y una receta 1 a 1 (vender 1
  // producto descuenta 1 de su propio insumo), sin tener que pasar por
  // la pestana Stock aparte. Los productos con receta compartida o mas
  // compleja (ej. una hamburguesa) se siguen cargando desde Stock.
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  initialStock?: number;
}
