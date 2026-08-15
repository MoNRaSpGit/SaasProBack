import { Type } from "class-transformer";
import { IsNumber, Min } from "class-validator";

export class UpdateJokerCierreDiaDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  total!: number;
}
