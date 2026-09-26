import { Type } from "class-transformer";
import { IsInt, Min } from "class-validator";

// Cambiar la cantidad de UN producto dentro de una venta ya guardada (pedido
// explicito, 26/09/2026: "-1+" en la boleta recien confirmada). El minimo es
// 1 -- para sacar el producto del todo hay que usar el flujo de eliminar,
// no bajar hasta 0 aca.
export class UpdateOriolSaleItemQuantityDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cantidad!: number;
}
