import { IsOptional, IsString, MaxLength, ValidateIf } from "class-validator";

export class LookupPosProductDto {
  @ValidateIf((object: LookupPosProductDto) => !object.sku)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  barcode?: string;

  @ValidateIf((object: LookupPosProductDto) => !object.barcode)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  sku?: string;
}
