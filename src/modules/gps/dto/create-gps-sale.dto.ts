import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsInt, IsPositive, Min, ValidateNested } from "class-validator";

export class GpsSaleItemDto {
  @IsInt()
  @IsPositive()
  productId!: number;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateGpsSaleDto {
  @IsInt()
  @IsPositive()
  clientId!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GpsSaleItemDto)
  items!: GpsSaleItemDto[];
}
