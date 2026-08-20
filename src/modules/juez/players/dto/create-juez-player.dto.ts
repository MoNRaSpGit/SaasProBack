import { IsDateString, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateJuezPlayerDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  team!: string;

  @IsIn(["A", "B"])
  division!: "A" | "B";

  @IsIn(["masculino", "femenino"])
  sex!: "masculino" | "femenino";

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  lastName!: string;

  @IsDateString()
  expiryDate!: string;

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

  // Foto opcional en formato data URI base64 (ej: "data:image/jpeg;base64,...").
  // Sin validar el formato exacto -- solo un techo de tamaño para no aceptar
  // archivos gigantes por error (unos 6MB decodificados).
  @IsOptional()
  @IsString()
  @MaxLength(8_000_000)
  photoDataUrl?: string;
}
