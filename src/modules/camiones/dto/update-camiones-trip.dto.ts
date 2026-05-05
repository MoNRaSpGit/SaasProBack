import { Type } from "class-transformer";
import { IsDateString, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class UpdateCamionesTripDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  placeId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  placeName?: string;

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
