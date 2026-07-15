import { IsInt, Min } from "class-validator";

export class UpdateCarnetEventPlayerDto {
  @IsInt()
  @Min(0)
  sales!: number;
}
