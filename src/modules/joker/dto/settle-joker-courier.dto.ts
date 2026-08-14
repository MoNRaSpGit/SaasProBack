import { Type } from "class-transformer";
import { IsNumber, IsOptional, Min } from "class-validator";

export class SettleJokerCourierDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  hourlyRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  hoursWorked?: number;
}
