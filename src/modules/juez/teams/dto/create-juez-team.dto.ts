import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateJuezTeamDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsIn(["A", "B"])
  division!: "A" | "B";

  @IsIn(["masculino", "femenino"])
  sex!: "masculino" | "femenino";

  // Quien hizo el alta (10/10/2026, pedido explicito: auditoria).
  @IsOptional()
  @IsString()
  @MaxLength(40)
  actor?: string;
}
