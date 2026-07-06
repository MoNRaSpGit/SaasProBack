import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateScrumTaskDto {
  @IsString()
  @MaxLength(180)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedMinutes?: number;

  @IsIn(["green", "yellow", "red", "blue"])
  difficulty!: "green" | "yellow" | "red" | "blue";
}
