import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";

export class CreateQqCategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  label!: string;

  // Si viene, es una subcategoria de esa categoria.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  parentId?: number;
}

export class RenameQqCategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  label!: string;
}

export class MoveQqCategoryDto {
  @IsIn(["up", "down"])
  direction!: "up" | "down";
}
