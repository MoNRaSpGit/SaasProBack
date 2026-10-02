import { IsIn, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { PELUQUEROS } from "../peluqueria.types";

export class CreatePeluqueriaReservationDto {
  @IsIn(PELUQUEROS)
  peluquero!: string;

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
