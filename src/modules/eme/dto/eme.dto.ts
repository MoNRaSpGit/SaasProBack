import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";

export const EME_CHANNELS = ["mesa", "mostrador", "whatsapp"] as const;
export const EME_KINDS = ["salon", "delivery", "retiro"] as const;
export const EME_PAYMENTS = ["efectivo", "tarjeta", "cuenta", "transferencia"] as const; // "tarjeta" se muestra como POS

export class EmeOrderLineDto {
  @IsString()
  @MaxLength(40)
  productId!: string;

  // Como se ve en el ticket (con extras y "sin").
  @IsString()
  @MaxLength(255)
  name!: string;

  // El producto solo (para la comanda).
  @IsOptional()
  @IsString()
  @MaxLength(120)
  baseName?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000)
  price!: number;

  @IsInt()
  @Min(1)
  @Max(999)
  qty!: number;

  // Nota de este producto (20/11/2026): "bien cocida", "que no se derrita la muzza".
  @IsOptional()
  @IsString()
  @MaxLength(160)
  note?: string;

  // Costo de los agregados de pizza de UNA unidad (20/11/2026), para la ganancia.
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100_000)
  extraCost?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  extras?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  removed?: string[];
}

export class CreateEmeOrderDto {
  @IsIn(EME_CHANNELS)
  channel!: (typeof EME_CHANNELS)[number];

  @IsIn(EME_KINDS)
  kind!: (typeof EME_KINDS)[number];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  table?: number | null;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(80)
  @ValidateNested({ each: true })
  @Type(() => EmeOrderLineDto)
  lines!: EmeOrderLineDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  clientName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @IsIn(EME_PAYMENTS)
  payment?: (typeof EME_PAYMENTS)[number];

  @IsOptional()
  @IsInt()
  @Min(1)
  clientId?: number | null;
}

export class PatchEmeOrderDto {
  @IsIn(["accept", "reject", "courier", "delivered", "kind", "cancel"])
  action!: "accept" | "reject" | "courier" | "delivered" | "kind" | "cancel";

  // action "kind" (19/11/2026): pasar el pedido a mostrador (retiro) o delivery.
  @IsOptional()
  @IsIn(["retiro", "delivery"])
  kind?: "retiro" | "delivery";

  @IsOptional()
  @IsInt()
  @Min(1)
  courierId?: number;
}

export class SaveEmeProductDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000)
  price!: number;

  // Nombre de la categoria; si no existe se crea.
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  category!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  ingredients?: string[];

  // Costo del producto (precio - ganancia), 19/11/2026. Si no viene, en una
  // edicion se deja el que estaba.
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000)
  cost?: number;
}

export class CreateEmeClientDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;
}

export class EmePaymentDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(10_000_000)
  amount!: number;
}

export class AddEmeCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;
}

// Caja (19/11/2026)
export class EmeOpeningDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10_000_000)
  amount!: number;
}

export class EmeExpenseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  description!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(10_000_000)
  amount!: number;
}

// Editar los productos de un pedido ya ingresado (20/11/2026).
export class EditEmeOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(80)
  @ValidateNested({ each: true })
  @Type(() => EmeOrderLineDto)
  lines!: EmeOrderLineDto[];
}

// Login (20/11/2026)
export class EmeLoginDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  username!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password!: string;
}
