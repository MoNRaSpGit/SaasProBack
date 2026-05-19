import { Type } from "class-transformer";
import { IsDateString, IsOptional, Max, Min } from "class-validator";

export class GetAlamcenDashboardDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  initialCash?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(200)
  movementLimit?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  rankingLimit?: number;
}
