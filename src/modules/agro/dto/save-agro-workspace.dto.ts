import { IsArray, IsIn, IsInt, IsOptional, Min } from "class-validator";

export class SaveAgroWorkspaceDto {
  @IsIn(["public"])
  workspaceKey!: "public";

  @IsIn(["v1"])
  version!: "v1";

  // La version de fila que el cliente vio la ultima vez que cargo/guardo el
  // workspace. Si no coincide con la actual en el momento de guardar, es
  // porque otro dispositivo/pestana ya guardo algo mas nuevo primero -
  // evita pisar esos cambios en silencio (ver assertWorkspaceRowVersion).
  @IsOptional()
  @IsInt()
  @Min(0)
  expectedRowVersion?: number | null;

  @IsArray()
  establishments!: unknown[];

  @IsArray()
  fields!: unknown[];

  @IsArray()
  animalMovements!: unknown[];

  @IsArray()
  accountingEntries!: unknown[];

  @IsArray()
  rainfallRecords!: unknown[];

  @IsArray()
  sanitaryRecords!: unknown[];

  @IsArray()
  monthlyExchangeRates!: unknown[];
}
