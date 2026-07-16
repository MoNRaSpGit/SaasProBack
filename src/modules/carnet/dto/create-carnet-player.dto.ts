import { IsDateString, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";

export class CreateCarnetPlayerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsDateString()
  expiryDate!: string;

  @IsString()
  @IsIn(["masculino", "femenino"])
  sex!: "masculino" | "femenino";

  @IsString()
  @MinLength(6)
  @MaxLength(20)
  cedula!: string;

  @IsDateString()
  birthDate!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sales?: number;
}
