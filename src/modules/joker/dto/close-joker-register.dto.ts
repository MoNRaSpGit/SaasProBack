import { Type } from "class-transformer";
import { IsArray, IsInt, IsNumber, IsString, Min, ValidateNested } from "class-validator";

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
}
