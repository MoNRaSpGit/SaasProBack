import { Type } from "class-transformer";
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { NEON_COST_CENTER_TYPES, NEON_JOURNAL_MOVEMENT_TYPES } from "./create-neon-journal-entry.dto";

export class ListNeonJournalDto {
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsIn(NEON_JOURNAL_MOVEMENT_TYPES)
  movementType?: (typeof NEON_JOURNAL_MOVEMENT_TYPES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  accountId?: number;

  @IsOptional()
  @IsIn(NEON_COST_CENTER_TYPES)
  costCenterType?: (typeof NEON_COST_CENTER_TYPES)[number];

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;
}
