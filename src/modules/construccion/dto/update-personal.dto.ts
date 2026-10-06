import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from "class-validator";
import { CARGOS } from "../construccion.types";

export class UpdatePersonalDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nombre?: string;

  @IsOptional()
  @IsIn(CARGOS)
  cargo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  telefono?: string;

  @IsOptional()
  @IsInt()
  obraId?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  jornal?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fechaIngreso?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
