import { Type } from "class-transformer";
import { IsNumber, IsPositive, IsString, MaxLength, MinLength } from "class-validator";

export class CreateDistribuidoraProductDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price!: number;
}
