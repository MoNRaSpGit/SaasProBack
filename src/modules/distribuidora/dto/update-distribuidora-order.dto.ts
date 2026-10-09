import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";
import { DistribuidoraOrderItemDto } from "./create-distribuidora-order.dto";

// Editar un pedido pendiente: se manda la lista COMPLETA de renglones
// como tiene que quedar (lo que no venga, se saca) y la nota.
export class UpdateDistribuidoraOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => DistribuidoraOrderItemDto)
  items!: DistribuidoraOrderItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
