import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { NEON_ACTIVITY_TYPES, NEON_COMMERCIAL_STATUSES } from "./create-neon-activity.dto";

export class UpdateNeonActivityDto {
  @IsOptional()
  @IsDateString()
  activityDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  clientId?: number | null;

  @IsOptional()
  @IsEnum(NEON_ACTIVITY_TYPES)
  activityType?: (typeof NEON_ACTIVITY_TYPES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  quotedAmount?: number;

  @IsOptional()
  @IsEnum(NEON_COMMERCIAL_STATUSES)
  commercialStatus?: (typeof NEON_COMMERCIAL_STATUSES)[number];
}
