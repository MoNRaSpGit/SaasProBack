import { IsNumber, IsOptional, IsString, Min, MaxLength } from "class-validator";

export class UpdateTallerStockItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  unit?: string;
}
