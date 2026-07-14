import { IsDateString, IsString, MaxLength, MinLength } from "class-validator";

export class CreateCarnetPlayerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsDateString()
  expiryDate!: string;
}
