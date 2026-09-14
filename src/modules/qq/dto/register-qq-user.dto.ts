import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class RegisterQqUserDto {
  @IsEmail()
  @MaxLength(191)
  email!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;
}
