import { IsString, MaxLength } from "class-validator";

export class UpdateScrumTaskDescriptionDto {
  // Vacio = sin descripcion. Mismo tope que al crear la tarea.
  @IsString()
  @MaxLength(500)
  description!: string;
}
