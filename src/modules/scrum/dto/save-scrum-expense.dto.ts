import { IsNumber, IsString, MaxLength, Min, MinLength } from "class-validator";

export class SaveScrumExpenseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  description!: string;

  // Monto por mes.
  @IsNumber()
  @Min(0.01)
  amount!: number;
}
