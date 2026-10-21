import { IsIn } from "class-validator";

export class ResolveRetoChallengeDto {
  @IsIn(["cumplido", "fallado"])
  result!: "cumplido" | "fallado";
}
