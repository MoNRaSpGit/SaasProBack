import { IsDateString, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";

export class UpdateCarnetPlayerDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  @IsIn(["masculino", "femenino"])
  sex?: "masculino" | "femenino";

  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(20)
  cedula?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sales?: number;
}
