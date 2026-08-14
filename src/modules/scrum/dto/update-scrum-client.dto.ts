import { IsIn, IsISO8601, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class UpdateScrumClientDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  amount?: number;

  @IsOptional()
  @IsIn(["monthly", "semiannual"])
  frequency?: "monthly" | "semiannual";

  @IsOptional()
  @IsISO8601()
  nextPaymentAt?: string;
}
