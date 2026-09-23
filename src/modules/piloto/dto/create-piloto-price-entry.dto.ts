import { Type } from "class-transformer";
import { IsIn, IsNumber, IsString, Min, MaxLength, MinLength } from "class-validator";
import { PilotoPriceCategory } from "../piloto.types";

const PRICE_CATEGORIES: PilotoPriceCategory[] = ["congelados", "frutas_verduras", "empanadas", "otros"];

export class CreatePilotoPriceEntryDto {
  @IsIn(PRICE_CATEGORIES)
  category!: PilotoPriceCategory;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  price!: number;
}
