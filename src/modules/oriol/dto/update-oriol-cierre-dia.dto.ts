import { Type } from "class-transformer";
import { IsNumber, Min } from "class-validator";

export class UpdateOriolCierreDiaDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  totalPesos!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  totalDolares!: number;
}
