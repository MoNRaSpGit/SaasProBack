import { Type } from "class-transformer";
import { IsNumber } from "class-validator";

// Fija el stock a un valor exacto (a diferencia de restock, que suma/resta
// una cantidad). Se usa desde el boton "Editar" del tablero de stock.
export class UpdateJokerStockItemDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  quantity!: number;
}
