import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from "class-validator";
import { normalizeUyPhone } from "../phone.util";

export class CamisetaCheckoutItemDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsInt()
  @Min(1)
  @Max(20)
  quantity!: number;
}

export class CreateCamisetasCheckoutDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CamisetaCheckoutItemDto)
  items!: CamisetaCheckoutItemDto[];

  // Para poder contactar al comprador y coordinar la entrega. Se pide
  // ANTES de ir a Mercado Pago (no hace falta cuenta ni registro).
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  customerName!: string;

  // Celular uruguayo real: 09X XXX XXX. Se normaliza (saca espacios/+598)
  // antes de validar, asi "092 945 696" y "+598 92 945 696" quedan igual.
  @Transform(({ value }) => (typeof value === "string" ? normalizeUyPhone(value) : value))
  @IsString()
  @Matches(/^09\d{7}$/, {
    message: "El celular no es válido. Usa el formato 09X XXX XXX (ej: 092 945 696)."
  })
  customerPhone!: string;
}
