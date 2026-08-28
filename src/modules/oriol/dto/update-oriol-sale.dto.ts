import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, ValidateNested } from "class-validator";
import { OriolSaleItemDto } from "./oriol-sale-item.dto";

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

  // Productos que se suman a una boleta ya guardada (el cliente pide algo
  // mas antes de retirarse): se agregan al detalle existente sin tocar los
  // items originales, y descuentan stock igual que una venta nueva.
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => OriolSaleItemDto)
  itemsNuevos?: OriolSaleItemDto[];
}
