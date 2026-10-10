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

  // Opcional desde 01/10/2026 (pedido explicito: "saca la parte de
  // Tareas") -- el frontend ya no manda este campo. Si el workspace ya
  // tenia tareas guardadas de antes, se conservan tal cual (ver
  // gym.service.ts#saveWorkspace), no se borran.
  @IsOptional()
  @IsArray()
  tasks?: unknown[];

  @IsArray()
  movements!: unknown[];

  // Opcional para no romper clientes viejos que todavia no mandan alumnos.
  @IsOptional()
  @IsArray()
  students?: unknown[];

  @IsOptional()
  @IsArray()
  checkIns?: unknown[];

  // Mediciones de "Mi Progreso" (10/10/2026). Opcional: un celular con
  // la app sin actualizar no las manda, y en ese caso se conservan las
  // que ya habia (ver gym.service.ts#saveWorkspace) en vez de borrarlas.
  @IsOptional()
  @IsArray()
  progressRecords?: unknown[];

  @IsArray()
  auditLog!: unknown[];
}
