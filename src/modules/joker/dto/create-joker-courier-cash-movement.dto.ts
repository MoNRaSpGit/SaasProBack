import { Type } from "class-transformer";
import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateJokerCourierCashMovementDto {
  @IsIn(["inicial", "gasto", "entrega"])
  type!: "inicial" | "gasto" | "entrega";

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
