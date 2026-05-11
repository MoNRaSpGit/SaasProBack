import { IsArray, IsIn } from "class-validator";

export class SaveAgroWorkspaceDto {
  @IsIn(["public"])
  workspaceKey!: "public";

  @IsIn(["v1"])
  version!: "v1";

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
