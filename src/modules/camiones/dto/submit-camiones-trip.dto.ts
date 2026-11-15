import { Type } from "class-transformer";
import { IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

// Lo que carga un camionero: con los kilometros que hizo, pero SIN valor
// (el valor/tarifa lo pone el administrador despues, 15/11/2026).
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

  // Kilometros del viaje: los pone el camionero.
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.1)
  @Max(100000)
  kilometers!: number;

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
