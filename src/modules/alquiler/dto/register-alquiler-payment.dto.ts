import { IsNumber, IsOptional, IsString, Min, MaxLength } from "class-validator";

export class RegisterAlquilerPaymentDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
