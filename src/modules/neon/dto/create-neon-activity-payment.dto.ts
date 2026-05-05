import { Type } from "class-transformer";
import { IsDateString, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateNeonActivityPaymentDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  accountId!: number;

  @IsDateString()
  paymentDate!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  paidAmount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
