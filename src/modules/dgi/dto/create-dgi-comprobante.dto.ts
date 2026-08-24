import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { DgiClienteDto } from "./dgi-cliente.dto";
import { DgiItemDto } from "./dgi-item.dto";

// tipo_comprobante: los mas comunes son 101 (e-Ticket) y 111 (e-Factura).
// Por defecto se usa e-Ticket porque es el mas simple para probar (no
// necesita datos del cliente si el importe es bajo).
export class CreateDgiComprobanteDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  sucursal?: number;

  @IsOptional()
  @IsInt()
  tipoComprobante?: number;

  @IsOptional()
  @IsIn(["UYU", "USD", "EUR"])
  moneda?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => DgiClienteDto)
  cliente?: DgiClienteDto;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DgiItemDto)
  items!: DgiItemDto[];

  @IsOptional()
  @IsString()
  informacionAdicional?: string;
}
