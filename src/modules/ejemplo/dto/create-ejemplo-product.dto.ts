import { IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateEjemploProductDto {
  @IsString()
  @MinLength(1)
  rubro!: string;

  @IsString()
  @MinLength(1)
  category!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsString()
  description?: string;
}
