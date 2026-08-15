import { Type } from "class-transformer";
import { ArrayMinSize, IsInt, ValidateNested } from "class-validator";
import { OriolSaleItemDto } from "./oriol-sale-item.dto";

// "Credito"/fiado: clienteId es obligatorio -- suma a la deuda del
// cliente y descuenta stock, todo en una misma transaccion.
export class CreateOriolSaleCreditoDto {
  @Type(() => Number)
  @IsInt()
  clienteId!: number;

  @ValidateNested({ each: true })
  @Type(() => OriolSaleItemDto)
  @ArrayMinSize(1)
  items!: OriolSaleItemDto[];
}
