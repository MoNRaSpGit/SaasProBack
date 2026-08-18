import { Type } from "class-transformer";
import { IsIn, IsNumber, IsOptional, Min } from "class-validator";

export class CreateOriolCreditPaymentDto {
  // Indica cual de los dos saldos independientes de la boleta (pesos o
  // dolares) paga este pago -- una boleta puede tener saldo pendiente en
  // ambas monedas a la vez si el carrito mezclo items en pesos y dolares.
  @IsIn(["UYU", "USD"])
  moneda!: "UYU" | "USD";

  @IsIn(["completo", "parcial"])
  tipo!: "completo" | "parcial";

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  monto?: number;
}
