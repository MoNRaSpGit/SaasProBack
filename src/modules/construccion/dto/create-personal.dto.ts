import { IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from "class-validator";
import { CARGOS } from "../construccion.types";

export class CreatePersonalDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nombre!: string;

  @IsIn(CARGOS)
  cargo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  telefono?: string;

  @IsOptional()
  @IsInt()
  obraId?: number;

  @IsNumber()
  @Min(0)
  jornal!: number;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fechaIngreso!: string;
}
