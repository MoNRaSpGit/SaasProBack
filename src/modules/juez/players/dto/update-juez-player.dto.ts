import { IsDateString, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateJuezPlayerDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  lastName?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  cedula?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8_000_000)
  photoDataUrl?: string;

  // Quien hizo la edicion (10/10/2026, pedido explicito: auditoria).
  @IsOptional()
  @IsString()
  @MaxLength(40)
  actor?: string;
}
