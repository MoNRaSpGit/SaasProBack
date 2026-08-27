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
}
