import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

// Edicion de los textos de la tarea: nombre y descripcion (ruta /description).
export class UpdateScrumTaskDescriptionDto {
  // Vacio = sin descripcion. Mismo tope que al crear la tarea.
  @IsString()
  @MaxLength(500)
  description!: string;

  // Si viene, cambia el nombre de la tarea (no puede quedar vacio).
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  title?: string;
}
