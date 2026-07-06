import { IsIn, IsInt, Min } from "class-validator";

export class UpdateScrumTaskDurationDto {
  @IsIn(["days", "weeks", "months"])
  durationUnit!: "days" | "weeks" | "months";

  @IsInt()
  @Min(1)
  durationValue!: number;
}
