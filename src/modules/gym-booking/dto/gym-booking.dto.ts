import { IsInt, IsString, Matches, MaxLength, MinLength, Min } from "class-validator";

export class CreateGymBookingDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  classKey!: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  hour!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;
}

export class CancelGymBookingDto {
  @IsInt()
  @Min(1)
  id!: number;

  @IsString()
  @MinLength(8)
  @MaxLength(32)
  cancelCode!: string;
}
