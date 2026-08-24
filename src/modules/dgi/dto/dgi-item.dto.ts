import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

// indicador_facturacion: 1=Exento IVA, 2=Tasa minima (10%), 3=Tasa basica
// (22%), 4=Otra, 5=Ficto, 6=No facturable, 7=Negativo, 8=A deducir,
// 9=A anular, 10=Exportacion, 11=Retencion, 12=IVA suspendido.
export class DgiItemDto {
  @IsNumber()
  @Min(0.001)
  cantidad!: number;

  @IsString()
  @MaxLength(80)
  concepto!: string;

  @IsNumber()
  @Min(0.000001)
  precio!: number;

  @IsString()
  @MaxLength(20)
  unidad!: string;

  @IsIn([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  indicadorFacturacion!: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

  @IsOptional()
  @IsNumber()
  descuento?: number;

  @IsOptional()
  @IsNumber()
  recargo?: number;
}
