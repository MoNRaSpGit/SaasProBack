import { IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";

export class UpdatePilotoProductDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  price?: number;
}
