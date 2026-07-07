import { IsIn } from "class-validator";

export class UpdateScrumTaskDifficultyDto {
  @IsIn(["green", "yellow", "red", "blue"])
  difficulty!: "green" | "yellow" | "red" | "blue";
}
