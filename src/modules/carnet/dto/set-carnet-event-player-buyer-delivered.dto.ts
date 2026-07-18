import { IsBoolean } from "class-validator";

export class SetCarnetEventPlayerBuyerDeliveredDto {
  @IsBoolean()
  delivered!: boolean;
}
