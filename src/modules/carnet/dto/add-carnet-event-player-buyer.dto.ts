import { IsInt, IsString, MaxLength, Min } from "class-validator";

export class AddCarnetEventPlayerBuyerDto {
  @IsString()
  @MaxLength(120)
  buyerName!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}
