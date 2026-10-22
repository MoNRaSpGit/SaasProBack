import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsPositive } from "class-validator";

// Hasta 50 paradas: es el maximo que acepta OpenRouteService en una ruta.
export class ComputeGpsRouteDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsInt({ each: true })
  @IsPositive({ each: true })
  clientIds!: number[];
}
