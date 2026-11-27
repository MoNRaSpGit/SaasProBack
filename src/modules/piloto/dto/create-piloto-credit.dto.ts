import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength, ValidateNested } from "class-validator";
import { CreatePilotoSaleItemDto } from "./create-piloto-sale.dto";

export class CreatePilotoCreditSaleDto {
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  requestId!: string;

  @IsInt()
  clientId!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePilotoSaleItemDto)
  items!: CreatePilotoSaleItemDto[];
}

export class CreatePilotoAccountPaymentDto {
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  requestId!: string;

  @IsInt()
  clientId!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  // true = "Saldar cuenta": el monto debe coincidir con el saldo.
  @IsOptional()
  @IsBoolean()
  settle?: boolean;
}
