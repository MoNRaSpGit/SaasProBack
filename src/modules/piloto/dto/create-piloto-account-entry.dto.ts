import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from "class-validator";

class PilotoAccountEntryItemDto {
  @IsString()
  @MaxLength(180)
  productName!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice!: number;
}

export class CreatePilotoAccountEntryDto {
  @IsInt()
  clientId!: number;

  @IsOptional()
  @IsInt()
  saleId?: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  total!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PilotoAccountEntryItemDto)
  items!: PilotoAccountEntryItemDto[];
}
