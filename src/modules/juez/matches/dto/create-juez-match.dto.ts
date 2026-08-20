import { IsDateString, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class CreateJuezMatchDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  tournament!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  homeSide!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  awaySide!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  venue!: string;

  @IsDateString()
  date!: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "Hora invalida (HH:mm)." })
  time!: string;
}
