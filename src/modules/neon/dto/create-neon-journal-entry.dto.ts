import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Matches,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested
} from "class-validator";

export const NEON_JOURNAL_MOVEMENT_TYPES = ["income", "expense"] as const;
export type NeonJournalMovementType = (typeof NEON_JOURNAL_MOVEMENT_TYPES)[number];

export const NEON_COST_CENTER_TYPES = ["activity", "vehicle", "personal", "rental", "other"] as const;
export type NeonCostCenterType = (typeof NEON_COST_CENTER_TYPES)[number];

export const NEON_JOURNAL_CURRENCIES = ["UYU", "USD"] as const;
export type NeonJournalCurrency = (typeof NEON_JOURNAL_CURRENCIES)[number];

export const NEON_EXPENSE_KINDS = ["operational", "credit_settlement"] as const;
export type NeonExpenseKind = (typeof NEON_EXPENSE_KINDS)[number];

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
      value.destinationType === "vehicle" ||
      value.destinationType === "other" ||
      value.destinationType === "personal" ||
      value.destinationType === "rental"
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
  @IsString()
  @MaxLength(120)
  providerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  documentRef?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  quantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(/^[^\d]+$/, { message: "unitLabel must not contain numbers" })
  unitLabel?: string;

  @IsOptional()
  @IsIn(NEON_JOURNAL_CURRENCIES)
  currencyCode?: NeonJournalCurrency;

  @IsOptional()
  @IsIn(NEON_EXPENSE_KINDS)
  expenseKind?: NeonExpenseKind;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  creditCardLabel?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

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
      value.costCenterType === "vehicle" ||
      value.costCenterType === "other" ||
      value.costCenterType === "personal" ||
      value.costCenterType === "rental"
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
