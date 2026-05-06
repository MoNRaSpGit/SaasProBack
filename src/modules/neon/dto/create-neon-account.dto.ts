import { Type } from "class-transformer";
import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";

export const NEON_ACCOUNT_TYPES = ["cash", "bank"] as const;
export type NeonAccountType = (typeof NEON_ACCOUNT_TYPES)[number];

export class CreateNeonAccountDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsIn(NEON_ACCOUNT_TYPES)
  accountType!: NeonAccountType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  openingBalance?: number;
}
