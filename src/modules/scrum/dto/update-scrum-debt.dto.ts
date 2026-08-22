import { IsISO8601, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateScrumDebtDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  name?: string;

  @IsOptional()
  @IsISO8601()
  dueDate?: string;
}
