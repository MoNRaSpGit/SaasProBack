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

  // "Producto no encontrado" (03/11/2026): el codigo con el que la
  // tablet no encontro el producto. Viaja con la linea para que, al
  // editarla en el mostrador, se pueda crear el producto real con ese
  // codigo en vez de solo renombrar el renglon.
  @IsOptional()
  @IsString()
  @MaxLength(64)
  pendingBarcode?: string | null;
}

export class SetPilotoFondoCartDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PilotoFondoItemDto)
  items!: PilotoFondoItemDto[];

  // true = la tablet apreto "Enviar al mostrador": se arma un pedido nuevo.
  @IsOptional()
  @IsBoolean()
  sent?: boolean;
}

// Tomar un pedido del fondo. Sin orderId = lo que la tablet esta pasando.
export class TakePilotoFondoDto {
  @IsOptional()
  @IsInt()
  @Min(2)
  orderId?: number;
}

// Sincronizar lo que ya se le entrego a la caja del borrador "en vivo"
// (03/11/2026, pedido explicito). claim = true solo en el primer click de
// "Tomar y seguir recibiendo" -- las sincronizaciones de ahi en mas no lo
// mandan.
export class SyncPilotoFondoDraftDto {
  @IsOptional()
  @IsBoolean()
  claim?: boolean;
}
