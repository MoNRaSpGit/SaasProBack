import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class LoginQqUserDto {
  @IsEmail()
  @MaxLength(191)
  email!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password!: string;
}
