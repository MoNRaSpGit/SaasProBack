import { Type } from "class-transformer";
import { IsNumber } from "class-validator";

export class RestockJokerStockItemDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  quantity!: number;
}
