import { IsISO8601, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateScrumDebtDto {
  @IsString()
  @MaxLength(180)
  name!: string;

  @IsNumber()
  @Min(1)
  amount!: number;

  // Si no se manda, el service la calcula como hoy + 1 mes.
  @IsOptional()
  @IsISO8601()
  dueDate?: string;
}
