import { Type } from "class-transformer";
import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateIf } from "class-validator";

export class UpdateQqProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  // null explicito = "borrar este precio" (el producto se queda con
  // uno solo) -- distinto de undefined, que significa "no tocar este
  // campo". Igual que en accountPrice mas abajo.
  @ValidateIf((dto) => dto.accountPrice !== undefined && dto.accountPrice !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  accountPrice?: number | null;

  @ValidateIf((dto) => dto.profilePrice !== undefined && dto.profilePrice !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  profilePrice?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsIn(["published", "draft"])
  status?: "published" | "draft";
}
