import { Type } from "class-transformer";
import { IsArray, ValidateNested } from "class-validator";
import { CreateJokerOrderItemDto } from "./create-joker-order.dto";

// A diferencia de CreateJokerOrderDto, acepta lista vacia: si el operario
// saca todos los productos, el pedido queda cancelado (total $0, sin items).
export class UpdateJokerOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateJokerOrderItemDto)
  items!: CreateJokerOrderItemDto[];
}
