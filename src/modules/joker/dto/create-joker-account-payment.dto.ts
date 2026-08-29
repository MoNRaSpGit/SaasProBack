import { Type } from "class-transformer";
import { IsInt, IsNumber, Min } from "class-validator";

export class CreateJokerAccountPaymentDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  clientId!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;
}
