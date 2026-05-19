import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from "class-validator";

export class CreateAlamcenSaleItemDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  productId?: number | null;

  @IsOptional()
  @IsBoolean()
  isManual?: boolean;

  @IsString()
  @MaxLength(180)
  nombre!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  precioVenta!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  quantity!: number;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string | null;
}

export class CreateAlamcenSaleDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateAlamcenSaleItemDto)
  items!: CreateAlamcenSaleItemDto[];
}
