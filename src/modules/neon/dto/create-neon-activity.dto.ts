import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

export const NEON_ACTIVITY_TYPES = ["neon", "movil_audiovisual", "otros"] as const;
export type NeonActivityType = (typeof NEON_ACTIVITY_TYPES)[number];

export const NEON_COMMERCIAL_STATUSES = [
  "pendiente_de_facturar",
  "facturado",
  "pendiente_de_cobrar",
  "cobrado"
] as const;
export type NeonCommercialStatus = (typeof NEON_COMMERCIAL_STATUSES)[number];

export class CreateNeonActivityDto {
  @IsDateString()
  activityDate!: string;

  @IsString()
  @MaxLength(255)
  description!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  clientId?: number;

  @IsEnum(NEON_ACTIVITY_TYPES)
  activityType!: NeonActivityType;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  quotedAmount!: number;

  @IsOptional()
  @IsEnum(NEON_COMMERCIAL_STATUSES)
  commercialStatus?: NeonCommercialStatus;
}
