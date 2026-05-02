import { Type } from "class-transformer";
import { IsOptional, Max, Min } from "class-validator";

export class GetPosDashboardDto {
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  movementLimit?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(20)
  rankingLimit?: number;
}
