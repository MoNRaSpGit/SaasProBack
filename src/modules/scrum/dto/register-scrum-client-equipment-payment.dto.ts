import { IsNumber, Min } from "class-validator";

export class RegisterScrumClientEquipmentPaymentDto {
  // Monto libre: una cuota, varias juntas o todo de golpe.
  @IsNumber()
  @Min(0.01)
  amount!: number;
}
