import { Type } from "class-transformer";
import { IsInt } from "class-validator";

export class CreateDeliverySignupDto {
  @Type(() => Number)
  @IsInt()
  userId!: number;
}
