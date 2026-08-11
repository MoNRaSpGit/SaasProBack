import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";

export class CreateJokerStockItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  quantity?: number;
}
