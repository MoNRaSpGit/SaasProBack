import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateSantiClientDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;
}

export class SetSantiWeeklyDto {
  // null = sin pedido para la semana (IsOptional deja pasar null).
  @IsOptional()
  @IsInt()
  menuId?: number | null;
}

export class SetSantiHistoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  dish!: string;
}

export class SetSantiMenuWeekDto {
  @IsBoolean()
  inWeek!: boolean;
}
