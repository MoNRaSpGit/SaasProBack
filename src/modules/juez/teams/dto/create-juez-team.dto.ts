import { IsIn, IsString, MaxLength, MinLength } from "class-validator";

export class CreateJuezTeamDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsIn(["A", "B"])
  division!: "A" | "B";

  @IsIn(["masculino", "femenino"])
  sex!: "masculino" | "femenino";
}
