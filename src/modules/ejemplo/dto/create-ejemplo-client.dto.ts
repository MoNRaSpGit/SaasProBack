import { IsOptional, IsString, MinLength } from "class-validator";

export class CreateEjemploClientDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
