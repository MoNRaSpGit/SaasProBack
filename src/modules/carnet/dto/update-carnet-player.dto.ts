import { IsDateString, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateCarnetPlayerDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}
