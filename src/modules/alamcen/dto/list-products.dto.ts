import { Type } from "class-transformer";
import { IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class ListAlamcenProductsDto {
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  search?: string;
}
