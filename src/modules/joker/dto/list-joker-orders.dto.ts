import { IsDateString, IsOptional } from "class-validator";

export class ListJokerOrdersDto {
  @IsOptional()
  @IsDateString()
  date?: string;
}
