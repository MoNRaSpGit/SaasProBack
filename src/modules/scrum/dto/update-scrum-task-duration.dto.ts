import { IsIn, IsInt, IsOptional, Min } from "class-validator";

export class UpdateScrumTaskDurationDto {
  @IsIn(["days", "weeks", "months"])
  durationUnit!: "days" | "weeks" | "months";

  @IsInt()
  @Min(1)
  durationValue!: number;

  @IsOptional()
  @IsIn(["green", "yellow", "red", "blue"])
  difficulty?: "green" | "yellow" | "red" | "blue";
}
