import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsString, MaxLength, MinLength, ValidateNested } from "class-validator";
import { JokerRecipeLineDto } from "./set-joker-product-recipe.dto";

export class BulkApplyJokerRecipeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  category!: string;

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => JokerRecipeLineDto)
  items!: JokerRecipeLineDto[];
}
