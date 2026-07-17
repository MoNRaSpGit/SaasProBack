import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from "class-validator";

export class CreatePilotoSaleItemDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  productId?: number | null;

  @IsString()
  @MaxLength(180)
  name!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  price!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  imageUrl?: string | null;
}

export class CreatePilotoSaleDto {
  @IsOptional()
  @IsIn(["efectivo", "tarjeta", "credito"])
  paymentMethod?: "efectivo" | "tarjeta" | "credito";

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePilotoSaleItemDto)
  items!: CreatePilotoSaleItemDto[];
}
