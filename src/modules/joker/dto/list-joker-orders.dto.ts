import { Type } from "class-transformer";
import { IsDateString, IsInt, IsOptional, Min } from "class-validator";

export class ListJokerOrdersDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  courierId?: number;
}
