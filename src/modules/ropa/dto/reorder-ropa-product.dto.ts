import { Type } from "class-transformer";
import { IsInt, Min } from "class-validator";

export class ReorderRopaProductDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  position!: number;
}
