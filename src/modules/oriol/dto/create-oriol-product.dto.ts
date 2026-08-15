import { Type } from "class-transformer";
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Min, MaxLength } from "class-validator";
import type { OriolCurrency } from "../oriol.types";

export class CreateOriolProductDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(["UYU", "USD"])
  currency!: OriolCurrency;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  codigoBarra?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stockMinimo?: number;
}
