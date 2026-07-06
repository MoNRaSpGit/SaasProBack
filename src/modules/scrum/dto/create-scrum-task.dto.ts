import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateScrumTaskDto {
  @IsString()
  @MaxLength(180)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsNumber()
  @Min(1)
  estimatedMinutes!: number;

  @IsIn(["green", "yellow", "red"])
  difficulty!: "green" | "yellow" | "red";
}
