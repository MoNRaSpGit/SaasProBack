import { Type } from "class-transformer";
import { IsArray, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";

class CloseJokerRegisterPaymentTotalsDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  efectivo!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tarjeta!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  transferencia!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cuenta!: number;
}

class CloseJokerRegisterRankingItemDto {
  @IsString()
  productName!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity!: number;
}

export class CloseJokerRegisterDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalVendido!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  ganancia!: number;

  @ValidateNested()
  @Type(() => CloseJokerRegisterPaymentTotalsDto)
  paymentTotals!: CloseJokerRegisterPaymentTotalsDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CloseJokerRegisterRankingItemDto)
  ranking!: CloseJokerRegisterRankingItemDto[];

  // Cuanto de totalVendido vino de mostrador/rol Usuario -- solo lo manda
  // el cierre de la caja general (PanelScreen), para archivar el
  // desglose por origen junto con el resto del cierre.
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  mostradorTotal?: number;
}
