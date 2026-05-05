import { Type } from "class-transformer";
import { IsEnum, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { NEON_ACTIVITY_TYPES, NEON_COMMERCIAL_STATUSES } from "./create-neon-activity.dto";

export class ListNeonActivitiesDto {
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @IsOptional()
  @IsEnum(NEON_ACTIVITY_TYPES)
  activityType?: (typeof NEON_ACTIVITY_TYPES)[number];

  @IsOptional()
  @IsEnum(NEON_COMMERCIAL_STATUSES)
  commercialStatus?: (typeof NEON_COMMERCIAL_STATUSES)[number];
}
