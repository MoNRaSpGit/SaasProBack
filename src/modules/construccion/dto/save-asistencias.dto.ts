import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsIn, IsInt, IsString, Matches, ValidateNested } from "class-validator";
import { ASISTENCIA_ESTADOS } from "../construccion.types";

class AsistenciaItemDto {
  @IsInt()
  personalId!: number;

  @IsIn(ASISTENCIA_ESTADOS)
  estado!: string;
}

// Guarda la asistencia de una obra/dia de una (pedido implicito: marcar
// rapido desde el celular en la obra, no uno por uno).
export class SaveAsistenciasDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fecha!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AsistenciaItemDto)
  items!: AsistenciaItemDto[];
}
