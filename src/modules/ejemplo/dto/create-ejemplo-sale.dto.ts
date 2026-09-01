import { IsIn, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

const PAYMENT_METHODS = ["efectivo", "tarjeta", "transferencia", "cuenta"] as const;

export class CreateEjemploSaleDto {
  @IsString()
  @MinLength(1)
  productId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsIn(PAYMENT_METHODS)
  paymentMethod!: (typeof PAYMENT_METHODS)[number];

  // Requerido solo cuando paymentMethod === "cuenta".
  @IsOptional()
  @IsString()
  clientId?: string;

  // Ingredientes/opciones elegidas al personalizar el producto antes de
  // sumarlo a la venta, ej: "Canela, Extra shot". Solo texto libre para
  // mostrar en el ticket y en el historial, no afecta el precio.
  @IsOptional()
  @IsString()
  detail?: string;
}
