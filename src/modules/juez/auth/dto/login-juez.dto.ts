import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class LoginJuezDto {
  @IsEmail()
  @MaxLength(191)
  email!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(72)
  password!: string;
}
