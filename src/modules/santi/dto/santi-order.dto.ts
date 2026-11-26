import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from "class-validator";

export class SantiOrderDayDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @IsInt()
  menuId!: number;
}

export class CreateSantiOrderDto {
  @IsInt()
  clientId!: number;

  @IsIn(["semanal", "dia"])
  kind!: "semanal" | "dia";

  @IsInt()
  @Min(1)
  @Max(20)
  qty!: number;

  @IsInt()
  @Min(0)
  @Max(1000000)
  total!: number;

  @IsIn(["pagado", "debe", "sena"])
  payStatus!: "pagado" | "debe" | "sena";

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000)
  paidAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => SantiOrderDayDto)
  days!: SantiOrderDayDto[];
}
