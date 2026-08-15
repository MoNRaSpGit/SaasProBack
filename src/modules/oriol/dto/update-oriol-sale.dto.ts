import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString } from "class-validator";

// Correccion de una venta ya cargada: metodo de pago y/o fecha y/o
// cliente. Si el metodo de pago cruza entre "credito" y otro, el service
// revierte/aplica la deuda del cliente correspondiente en una transaccion.
export class UpdateOriolSaleDto {
  @IsOptional()
  @IsIn(["efectivo", "tarjeta", "credito"])
  metodoPago?: "efectivo" | "tarjeta" | "credito";

  @IsOptional()
  @IsString()
  fecha?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  clienteId?: number;
}
