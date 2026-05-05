import { Type } from "class-transformer";
import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateIf } from "class-validator";

export const NEON_EXPENSE_DESTINATION_TYPES = ["activity", "personal", "vehicle", "other"] as const;
export type NeonExpenseDestinationType = (typeof NEON_EXPENSE_DESTINATION_TYPES)[number];

export class CreateNeonExpenseDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  accountId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId!: number;

  @IsDateString()
  expenseDate!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  totalAmount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsIn(NEON_EXPENSE_DESTINATION_TYPES)
  destinationType!: NeonExpenseDestinationType;

  @ValidateIf((value: CreateNeonExpenseDto) => value.destinationType === "activity")
  @Type(() => Number)
  @IsInt()
  @Min(1)
  destinationActivityId?: number;

  @ValidateIf((value: CreateNeonExpenseDto) => value.destinationType === "other")
  @IsString()
  @MaxLength(255)
  destinationLabel?: string;
}
