import { Type } from "class-transformer";
import { ArrayMinSize, IsIn, IsInt, IsOptional, ValidateNested } from "class-validator";
import { OriolSaleItemDto } from "./oriol-sale-item.dto";

// "Contado": efectivo o tarjeta. clienteId es opcional -- solo etiqueta la
// venta con un cliente para historial/reimpresion, nunca toca la deuda.
export class CreateOriolSaleContadoDto {
  @IsIn(["efectivo", "tarjeta"])
  metodoPago!: "efectivo" | "tarjeta";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  clienteId?: number;

  @ValidateNested({ each: true })
  @Type(() => OriolSaleItemDto)
  @ArrayMinSize(1)
  items!: OriolSaleItemDto[];
}
