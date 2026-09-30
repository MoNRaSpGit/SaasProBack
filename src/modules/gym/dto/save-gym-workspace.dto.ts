import { IsArray, IsInt, IsOptional, Min } from "class-validator";

export class SaveGymWorkspaceDto {
  // La version de fila que el cliente vio la ultima vez que cargo/guardo el
  // workspace -- si no coincide con la actual al guardar, es porque otra
  // pestana/dispositivo ya guardo algo mas nuevo primero.
  @IsOptional()
  @IsInt()
  @Min(0)
  expectedRowVersion?: number | null;

  @IsArray()
  expenses!: unknown[];

  @IsArray()
  tasks!: unknown[];

  @IsArray()
  movements!: unknown[];

  @IsArray()
  auditLog!: unknown[];
}
