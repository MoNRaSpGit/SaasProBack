import { IsIn, IsString, MinLength } from "class-validator";

export class LoginJokerDto {
  @IsIn(["administrador", "usuario"])
  role!: "administrador" | "usuario";

  @IsString()
  @MinLength(1)
  password!: string;
}
