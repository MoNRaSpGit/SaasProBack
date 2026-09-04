import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, MaxLength, Min, ValidateNested } from "class-validator";
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
  // (ej: se carago "efectivo" pero era "transferencia"). "cuenta" tambien
  // se acepta, pero solo junto con clientId (ver mas abajo) -- pasar a
  // cuenta corriente sin cliente no tiene sentido.
  @IsOptional()
  @IsIn(["efectivo", "tarjeta", "transferencia", "cuenta"])
  paymentMethod?: "efectivo" | "tarjeta" | "transferencia" | "cuenta";

  // Obligatorio (y solo usado) cuando paymentMethod pasa a "cuenta" y el
  // pedido no era "a cuenta" todavia: crea el movimiento de cuenta
  // corriente vinculado a este pedido, igual que al armar un pedido nuevo
  // "a cuenta" desde la pantalla de Pedidos.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  clientId?: number;

  // Para marcar/desmarcar un pedido como "Mostrador" (retirado en el local,
  // sin repartidor) desde el Panel -- reusa el mismo mecanismo que ya
  // distingue pedidos de mostrador en toda la app (nombre con "MOSTRADOR"),
  // ver PanelScreen#handleAssignCounter en el frontend.
  @IsOptional()
  @IsString()
  @MaxLength(160)
  customerName?: string;

  // Saca el repartidor asignado (vuelve a "Sin designar" o a "Mostrador",
  // segun lo que se mande junto con esto). courierId no sirve para esto:
  // al no mandarlo, el pedido conserva el que ya tenia (ver
  // JokerOrdersService#updateOrder) -- hace falta esta bandera aparte para
  // poder mandar explicitamente "sacaselo", que es lo que necesita
  // PanelScreen#handleAssignCounter cuando el pedido que se pasa a
  // Mostrador ya tenia un delivery asignado.
  @IsOptional()
  @IsBoolean()
  clearCourier?: boolean;

  // Rol que hizo esta edicion (Administrador o Usuario) -- el cliente
  // pidio que quede registro de quien toco un pedido, sobre todo ahora que
  // los dos roles pueden editar desde el Historial de ventas. Se guarda
  // junto con la fecha/hora de esta edicion; queda solo la ULTIMA, no un
  // historial completo.
  @IsOptional()
  @IsIn(["administrador", "usuario"])
  editedByRole?: "administrador" | "usuario";
}
