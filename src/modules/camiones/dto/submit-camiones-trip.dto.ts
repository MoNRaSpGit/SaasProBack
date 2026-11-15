import { Type } from "class-transformer";
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";

// Lo que carga un camionero: sin kilometros ni valor (eso lo pone el
// administrador despues).
export class SubmitCamionesTripDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  clientId!: number;

  @IsIn(["mercedes", "volkswagen"])
  truck!: "mercedes" | "volkswagen";

  // true = el camion fue con zorra.
  @IsBoolean()
  withTrailer!: boolean;

  @IsDateString()
  tripDate!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  fromPlaceName!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  placeId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  placeName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  description?: string;
}
