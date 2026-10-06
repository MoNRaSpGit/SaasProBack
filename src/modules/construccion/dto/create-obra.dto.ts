import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateObraDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  direccion?: string;
}
