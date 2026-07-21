import { IsDateString, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateJuezPlayerDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  team!: string;

  @IsIn(["A", "B"])
  division!: "A" | "B";

  @IsIn(["masculino", "femenino"])
  sex!: "masculino" | "femenino";

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsDateString()
  expiryDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  cedula?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;
}
