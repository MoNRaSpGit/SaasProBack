import { IsIn, IsString, MaxLength, MinLength } from "class-validator";

export class CreateRetoChallengeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;

  @IsIn(["unico", "diario", "semanal"])
  type!: "unico" | "diario" | "semanal";
}
