import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsString, Matches, ValidateNested } from "class-validator";
import { SEGURIDAD_ITEMS } from "../construccion.types";

class SeguridadItemDto {
  @IsInt()
  personalId!: number;

  @IsBoolean()
  cumple!: boolean;

  @IsArray()
  @IsIn(SEGURIDAD_ITEMS, { each: true })
  itemsFaltantes!: string[];
}

// Mismo patron que SaveAsistenciasDto: se guarda el control de un dia
// entero de una (pedido explicito: "luego de marcar las personas que
// asistieron se van a seguridad y ahi le controlamos eso").
export class SaveSeguridadDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fecha!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SeguridadItemDto)
  items!: SeguridadItemDto[];
}
