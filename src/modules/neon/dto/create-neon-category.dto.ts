import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export const NEON_CATEGORY_MOVEMENT_TYPES = ["income", "expense"] as const;
export type NeonCategoryMovementType = (typeof NEON_CATEGORY_MOVEMENT_TYPES)[number];

export const NEON_CATEGORY_CLASSIFICATIONS = ["empresa", "personal"] as const;
export type NeonCategoryClassification = (typeof NEON_CATEGORY_CLASSIFICATIONS)[number];

export class CreateNeonCategoryDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsIn(NEON_CATEGORY_MOVEMENT_TYPES)
  movementType?: NeonCategoryMovementType;

  @IsOptional()
  @IsIn(NEON_CATEGORY_CLASSIFICATIONS)
  classification?: NeonCategoryClassification;
}
