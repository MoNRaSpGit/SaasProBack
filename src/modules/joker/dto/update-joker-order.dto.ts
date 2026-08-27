import { Type } from "class-transformer";
import { IsArray, IsIn, IsInt, IsNumber, IsOptional, Matches, Min, ValidateNested } from "class-validator";
import { CreateJokerOrderItemDto } from "./create-joker-order.dto";

// A diferencia de CreateJokerOrderDto, acepta lista vacia: si el operario
// saca todos los productos, el pedido queda cancelado (total $0, sin items).
export class UpdateJokerOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateJokerOrderItemDto)
  items!: CreateJokerOrderItemDto[];

  // Igual que en la creacion: si no se manda, la fecha del pedido queda
  // como estaba.
  @IsOptional()
  @Matches(/^(\d{4}-\d{2}-\d{2})?$/)
  orderDate?: string;

  // Igual que arriba: si no se manda ninguno de los dos, quedan como estaban.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  courierId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  deliveryCost?: number;

  // Para corregir un pedido marcado con el metodo de pago equivocado
  // (ej: se carago "efectivo" pero era "transferencia"). No se acepta
  // "cuenta" aca -- pasar a/desde cuenta corriente necesita elegir un
  // cliente, eso se sigue haciendo desde el flujo normal de armar
  // pedido, no desde esta correccion rapida.
  @IsOptional()
  @IsIn(["efectivo", "tarjeta", "transferencia"])
  paymentMethod?: "efectivo" | "tarjeta" | "transferencia";
}
