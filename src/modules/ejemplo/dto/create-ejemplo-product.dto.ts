import { IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateEjemploProductDto {
  @IsString()
  @MinLength(1)
  rubro!: string;

  @IsString()
  @MinLength(1)
  category!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsString()
  description?: string;

  // Data URL (base64) de la imagen, ya redimensionada/comprimida en el
  // frontend antes de mandarla -- ver ejemplo.image.ts. Puede pesar varios
  // cientos de KB como texto, por eso el body parser del backend acepta
  // hasta 10mb (ver main.ts).
  @IsOptional()
  @IsString()
  imageUrl?: string;
}
