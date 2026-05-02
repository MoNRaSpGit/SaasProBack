import { Type } from "class-transformer";
import { IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class ListCamionesClientsDto {
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;
}
