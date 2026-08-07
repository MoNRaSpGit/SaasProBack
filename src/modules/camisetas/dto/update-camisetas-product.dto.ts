import { IsNumber, IsOptional, IsPositive, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateCamisetasProductDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  price?: number;
}
