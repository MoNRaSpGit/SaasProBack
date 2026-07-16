import { ArrayNotEmpty, IsArray, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

const JUEZ_ROLES = ["principal", "secundario", "planillero"] as const;

export type JuezRole = (typeof JUEZ_ROLES)[number];

export class RegisterJuezDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  city!: string;

  @IsEmail()
  @MaxLength(191)
  email!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(72)
  password!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsIn(JUEZ_ROLES, { each: true })
  roles!: JuezRole[];

  @IsOptional()
  @IsString()
  @MaxLength(191)
  redirectUrl?: string;
}
