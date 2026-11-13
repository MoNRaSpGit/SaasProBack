import { IsInt, IsNumber, Max, Min } from "class-validator";

export class SetScrumClientEquipmentDto {
  // Cuota que paga el cliente por el equipo (ej: 200).
  @IsNumber()
  @Min(1)
  installmentAmount!: number;

  // En cuantos meses se termina de pagar (ej: 10).
  @IsInt()
  @Min(1)
  @Max(120)
  months!: number;
}
