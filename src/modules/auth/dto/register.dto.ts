import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class RegisterDto {
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

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  tenantName?: string;
}
