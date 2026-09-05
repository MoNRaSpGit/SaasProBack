import { Type } from "class-transformer";
import { IsNumber, IsString, MaxLength, Min, MinLength } from "class-validator";

export class CreateJokerAdminExpenseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  description!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;
}
