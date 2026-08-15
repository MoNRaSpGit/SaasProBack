import { Type } from "class-transformer";
import { IsIn, IsNumber, IsOptional, Min } from "class-validator";

export class CreateOriolCreditPaymentDto {
  @IsIn(["completo", "parcial"])
  tipo!: "completo" | "parcial";

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  monto?: number;
}
