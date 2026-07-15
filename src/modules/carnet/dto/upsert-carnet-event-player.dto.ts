import { IsInt, Min } from "class-validator";

export class UpsertCarnetEventPlayerDto {
  @IsInt()
  @Min(1)
  playerId!: number;

  @IsInt()
  @Min(0)
  sales!: number;
}
