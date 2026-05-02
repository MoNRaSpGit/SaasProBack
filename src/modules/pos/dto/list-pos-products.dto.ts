import { Type } from "class-transformer";
import { IsOptional, IsString, Max, Min } from "class-validator";

export class ListPosProductsDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;
}
