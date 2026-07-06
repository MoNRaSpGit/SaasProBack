import { IsIn, IsISO8601, IsNumber, IsString, MaxLength, Min } from "class-validator";

export class CreateScrumClientDto {
  @IsString()
  @MaxLength(180)
  name!: string;

  @IsNumber()
  @Min(1)
  amount!: number;

  @IsIn(["monthly", "semiannual"])
  frequency!: "monthly" | "semiannual";

  @IsISO8601()
  nextPaymentAt!: string;
}
