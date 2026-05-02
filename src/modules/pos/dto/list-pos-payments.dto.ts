import { Type } from "class-transformer";
import { IsOptional, Max, Min } from "class-validator";

export class ListPosPaymentsDto {
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;
}
