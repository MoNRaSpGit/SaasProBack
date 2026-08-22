import { IsNumber, Min } from "class-validator";

export class CreateScrumDebtPaymentDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;
}
