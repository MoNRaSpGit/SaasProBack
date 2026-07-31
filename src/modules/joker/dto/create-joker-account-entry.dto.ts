import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsInt, IsNumber, IsString, MaxLength, Min, ValidateNested } from "class-validator";

export class CreateJokerAccountEntryItemDto {
  @IsString()
  @MaxLength(180)
  productName!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateJokerAccountEntryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  clientId!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  total!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateJokerAccountEntryItemDto)
  items!: CreateJokerAccountEntryItemDto[];
}
