import { Type } from "class-transformer";
import { IsDateString, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateCamionesTripDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  clientId!: number;

  @IsDateString()
  tripDate!: string;

  @IsString()
  @MaxLength(160)
  place!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  kilometers!: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}
