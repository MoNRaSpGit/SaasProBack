import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from "class-validator";

export class UpdateAlquilerLocalDto {
  @IsOptional()
  @IsBoolean()
  occupied?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  businessType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  tenantName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  paymentDay?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  rentAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  // String vacio = borrar la fecha (sin contrato con vencimiento cargado).
  @IsOptional()
  @Matches(/^(\d{4}-\d{2}-\d{2})?$/)
  contractEndDate?: string;
}
