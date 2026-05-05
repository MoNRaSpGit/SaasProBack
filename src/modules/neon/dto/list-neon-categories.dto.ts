import { IsIn, IsOptional } from "class-validator";
import { NEON_CATEGORY_MOVEMENT_TYPES } from "./create-neon-category.dto";

export class ListNeonCategoriesDto {
  @IsOptional()
  @IsIn(NEON_CATEGORY_MOVEMENT_TYPES)
  movementType?: "income" | "expense";
}
