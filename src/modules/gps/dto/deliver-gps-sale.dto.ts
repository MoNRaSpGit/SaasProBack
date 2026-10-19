import { IsString, MaxLength, MinLength } from "class-validator";

export class DeliverGpsSaleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  courierName!: string;
}
