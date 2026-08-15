import { Type } from "class-transformer";
import { IsInt, IsOptional, Min } from "class-validator";

// Actualizacion parcial: stock y/o stockMinimo por separado, sin tener que
// mandar el producto completo (igual que el original).
export class UpdateOriolStockDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stockMinimo?: number;
}
