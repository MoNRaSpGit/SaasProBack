import { Type } from "class-transformer";
import { IsNumber, IsString, MaxLength, Min } from "class-validator";

export class CreateOriolPaymentDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  valor!: number;

  @IsString()
  @MaxLength(255)
  detalle!: string;
}
