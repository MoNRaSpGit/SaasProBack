import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsInt, IsOptional, IsPositive } from "class-validator";

// Hasta 50 paradas: es el maximo que acepta OpenRouteService en una ruta.
export class ComputeGpsRouteDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsInt({ each: true })
  @IsPositive({ each: true })
  clientIds!: number[];

  // true = respetar el orden de clientIds (orden elegido a mano): no se
  // optimiza, solo se dibuja el recorrido por calles.
  @IsOptional()
  @IsBoolean()
  keepOrder?: boolean;
}
