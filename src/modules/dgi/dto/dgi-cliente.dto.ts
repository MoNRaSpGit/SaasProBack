import { IsIn, IsInt, IsOptional, IsString, MaxLength } from "class-validator";

// tipo_doc: 1=NIE, 2=RUC, 3=CI, 4=Otro, 5=Pasaporte, 6=DNI, 7=NIFE
export class DgiClienteDto {
  @IsIn([1, 2, 3, 4, 5, 6, 7])
  tipoDoc!: 1 | 2 | 3 | 4 | 5 | 6 | 7;

  @IsString()
  @MaxLength(2)
  codPaisDoc!: string;

  @IsString()
  @MaxLength(20)
  nroDoc!: string;

  @IsString()
  @MaxLength(150)
  denominacion!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  correoElectronico?: string;

  @IsOptional()
  @IsString()
  @MaxLength(70)
  direccion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(70)
  ciudad?: string;

  @IsOptional()
  @IsInt()
  cp?: number;
}
