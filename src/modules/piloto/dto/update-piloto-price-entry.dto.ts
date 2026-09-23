import { Type } from "class-transformer";
import { IsNumber, IsString, Min, MaxLength, MinLength } from "class-validator";

// Editar solo corrige nombre/precio (pedido explicito: "poder... corregir
// rapidamente un nombre o precio") -- la categoria queda fija desde que se
// crea, no se pide poder moverlo de categoria.
export class UpdatePilotoPriceEntryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  price!: number;
}
