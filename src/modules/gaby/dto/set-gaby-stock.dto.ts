import { IsNumber, Min } from "class-validator";

export class SetGabyStockDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  stock!: number;
}
