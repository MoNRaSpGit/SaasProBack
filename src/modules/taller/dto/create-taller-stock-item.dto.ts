import { IsNumber, IsOptional, IsString, Min, MaxLength } from "class-validator";

export class CreateTallerStockItemDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsNumber()
  @Min(0)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  unit?: string;
}
