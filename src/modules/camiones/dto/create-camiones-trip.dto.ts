import { Type } from "class-transformer";
import { IsDateString, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateCamionesTripDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  clientId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  placeId!: number;

  @IsDateString()
  tripDate!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  kilometers!: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}
