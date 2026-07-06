import { IsIn, IsISO8601, IsOptional } from "class-validator";

export class UpdateScrumTaskStatusDto {
  @IsIn(["todo", "in_progress", "done"])
  status!: "todo" | "in_progress" | "done";

  @IsOptional()
  @IsISO8601()
  startedAt?: string | null;

  @IsOptional()
  @IsISO8601()
  completedAt?: string | null;
}
