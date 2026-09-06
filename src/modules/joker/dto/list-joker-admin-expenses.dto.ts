import { IsDateString, IsOptional } from "class-validator";

export class ListJokerAdminExpensesDto {
  @IsOptional()
  @IsDateString()
  date?: string;
}
