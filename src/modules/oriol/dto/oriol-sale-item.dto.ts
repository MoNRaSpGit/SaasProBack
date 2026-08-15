import { Type } from "class-transformer";
import { IsIn, IsInt, IsNumber, IsString, Min, MaxLength } from "class-validator";
import type { OriolCurrency } from "../oriol.types";

export class OriolSaleItemDto {
  @Type(() => Number)
  @IsInt()
  id!: number;

  @IsString()
  @MaxLength(255)
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  cantidad!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precio!: number;

  @IsIn(["UYU", "USD"])
  currency!: OriolCurrency;
}
