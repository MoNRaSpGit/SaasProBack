import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsPositive } from "class-validator";

// Orden de visita elegido a mano para una ruta final ya generada.
export class SaveGpsFinalOrderDto {
  @IsInt()
  @IsPositive()
  routeId!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsInt({ each: true })
  @IsPositive({ each: true })
  clientIds!: number[];
}
