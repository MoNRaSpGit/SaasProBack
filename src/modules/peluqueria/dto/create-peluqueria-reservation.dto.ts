import { Type } from "class-transformer";
import { IsInt, IsString, Matches, MaxLength, Min, MinLength } from "class-validator";

export class CreatePeluqueriaReservationDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  barberId!: number;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  time!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  clientName!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(40)
  clientPhone!: string;
}
