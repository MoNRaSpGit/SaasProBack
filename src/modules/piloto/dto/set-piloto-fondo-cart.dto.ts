import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from "class-validator";

export class PilotoFondoItemDto {
  @IsInt()
  productId!: number;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  imageUrl?: string | null;
}

export class SetPilotoFondoCartDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PilotoFondoItemDto)
  items!: PilotoFondoItemDto[];

  // true = la tablet apreto "Enviar al mostrador" (el mostrador recibe aviso).
  @IsOptional()
  @IsBoolean()
  sent?: boolean;
}
