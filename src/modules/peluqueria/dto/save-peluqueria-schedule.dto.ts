import { IsInt, IsObject, Max, Min } from "class-validator";

// Horario semanal editado por el dueño. Los tramos se validan a fondo en
// peluqueria-schedule.ts (validateScheduleInput); aca solo la forma general.
export class SavePeluqueriaScheduleDto {
  @IsInt()
  @Min(10)
  @Max(240)
  slotMinutes!: number;

  @IsObject()
  days!: Record<string, Array<[string, string]>>;
}
