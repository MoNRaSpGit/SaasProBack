import { IsNumber, IsString, Min } from "class-validator";

export class UpdateProductDto {
  @IsString()
  nombre!: string;

  @IsNumber()
  @Min(0.01)
  precioVenta!: number;
}
