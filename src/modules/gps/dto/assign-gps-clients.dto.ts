import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, IsPositive, IsString, MaxLength } from "class-validator";

// Asigna clientes a un repartidor (pestaña). persona = null los devuelve a
// "sin asignar".
export class AssignGpsClientsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @IsInt({ each: true })
  @IsPositive({ each: true })
  clientIds!: number[];

  @IsOptional()
  @IsString()
  @MaxLength(60)
  persona?: string | null;
}
