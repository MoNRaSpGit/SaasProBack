import { IsNumber, IsString, MaxLength, Min, MinLength } from "class-validator";

export class CreateScrumDebtChargeDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  detail!: string;
}
