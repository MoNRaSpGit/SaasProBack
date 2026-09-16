import { Type } from "class-transformer";
import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateIf } from "class-validator";

export class CreateQqProductDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  // Los dos precios son opcionales CADA UNO, pero no los dos a la vez --
  // "hay tarjetas que llevan los dos, otras que no" (16/09/2026). La
  // validacion de "al menos uno" vive en el service (ahi es mas facil
  // dar un mensaje de error claro que con un decorador cruzado).
  @ValidateIf((dto) => dto.accountPrice !== undefined)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  accountPrice?: number;

  @ValidateIf((dto) => dto.profilePrice !== undefined)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  profilePrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsIn(["published", "draft"])
  status?: "published" | "draft";
}
