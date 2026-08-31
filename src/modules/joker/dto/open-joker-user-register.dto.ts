import { Type } from "class-transformer";
import { IsNumber, Min } from "class-validator";

export class OpenJokerUserRegisterDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  initialCash!: number;
}
