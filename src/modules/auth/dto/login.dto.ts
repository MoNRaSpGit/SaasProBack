import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class LoginDto {
  @IsOptional()
  @IsString()
  @MaxLength(191)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  identifier?: string;

  @IsString()
  @MinLength(4)
  @MaxLength(72)
  password!: string;
}
