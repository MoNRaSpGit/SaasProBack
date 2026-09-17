import { Type } from "class-transformer";
import { IsInt, Min } from "class-validator";

export class ReorderQqProductDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  position!: number;
}
