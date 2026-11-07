import { IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";

export class UpdateGabyProductDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  price?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  stock?: number;
}
