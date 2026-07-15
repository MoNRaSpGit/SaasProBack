import { IsDateString, IsString, MaxLength, MinLength } from "class-validator";

export class CreateCarnetEventDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsDateString()
  endDate!: string;
}
