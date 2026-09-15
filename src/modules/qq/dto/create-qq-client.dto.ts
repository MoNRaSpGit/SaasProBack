import { IsDateString, IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateQqClientDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  // Solo la fecha (YYYY-MM-DD) -- el semaforo blanco/amarillo/rojo se
  // calcula en el frontend a partir de esto, no hace falta hora.
  @IsDateString()
  dueDate!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;
}
