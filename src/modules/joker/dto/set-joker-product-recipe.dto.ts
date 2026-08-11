import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsInt, IsNumber, Min, ValidateNested } from "class-validator";

export class JokerRecipeLineDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  stockItemId!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  quantityPerUnit!: number;
}

export class SetJokerProductRecipeDto {
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => JokerRecipeLineDto)
  items!: JokerRecipeLineDto[];
}
