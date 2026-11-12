import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

// Editar un cliente (12/11/2026): se corrige el nombre mal escrito, el
// telefono o la direccion. Un telefono/direccion vacio los deja en blanco.
export class UpdateGabyClientDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;
}
