import { IsNumber, Min } from "class-validator";

export class RegisterScrumClientDebtPaymentDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;
}
