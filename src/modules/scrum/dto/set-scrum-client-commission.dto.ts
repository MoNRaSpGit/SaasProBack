import { IsNumber, Max, Min } from "class-validator";

export class SetScrumClientCommissionDto {
  // Porcentaje del monto que se le da a quien vendio (0 = sin comision).
  @IsNumber()
  @Min(0)
  @Max(100)
  percent!: number;
}
