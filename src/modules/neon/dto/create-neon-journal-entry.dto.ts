import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested
} from "class-validator";

export const NEON_JOURNAL_MOVEMENT_TYPES = ["income", "expense"] as const;
export type NeonJournalMovementType = (typeof NEON_JOURNAL_MOVEMENT_TYPES)[number];

export const NEON_COST_CENTER_TYPES = ["activity", "vehicle", "personal", "other"] as const;
export type NeonCostCenterType = (typeof NEON_COST_CENTER_TYPES)[number];

export class CreateNeonJournalAllocationDto {
  @IsIn(NEON_COST_CENTER_TYPES)
  destinationType!: NeonCostCenterType;

  @ValidateIf((value: CreateNeonJournalAllocationDto) => value.destinationType === "activity")
  @Type(() => Number)
  @IsInt()
  @Min(1)
  destinationActivityId?: number;

  @ValidateIf(
    (value: CreateNeonJournalAllocationDto) =>
      value.destinationType === "vehicle" || value.destinationType === "other" || value.destinationType === "personal"
  )
  @IsString()
  @MaxLength(255)
  destinationLabel?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ValidateIf((value: CreateNeonJournalAllocationDto) => value.destinationType === "vehicle")
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  kilometers?: number;

  @ValidateIf((value: CreateNeonJournalAllocationDto) => value.destinationType === "vehicle")
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  liters?: number;
}

export class CreateNeonJournalEntryDto {
  @IsIn(NEON_JOURNAL_MOVEMENT_TYPES)
  movementType!: NeonJournalMovementType;

  @IsDateString()
  movementDate!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  accountId!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  totalAmount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsIn(NEON_COST_CENTER_TYPES)
  costCenterType?: NeonCostCenterType;

  @ValidateIf((value: CreateNeonJournalEntryDto) => value.costCenterType === "activity")
  @Type(() => Number)
  @IsInt()
  @Min(1)
  destinationActivityId?: number;

  @ValidateIf(
    (value: CreateNeonJournalEntryDto) =>
      value.costCenterType === "vehicle" || value.costCenterType === "other" || value.costCenterType === "personal"
  )
  @IsString()
  @MaxLength(255)
  destinationLabel?: string;

  @ValidateIf((value: CreateNeonJournalEntryDto) => value.costCenterType === "vehicle")
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  kilometers?: number;

  @ValidateIf((value: CreateNeonJournalEntryDto) => value.costCenterType === "vehicle")
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  liters?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateNeonJournalAllocationDto)
  allocations?: CreateNeonJournalAllocationDto[];
}
