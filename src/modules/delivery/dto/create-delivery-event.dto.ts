import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateDeliveryEventDto {
  @IsString()
  @MaxLength(200)
  place!: string;

  // ISO datetime local sin zona (ej: "2026-09-18T20:00"), tal cual lo manda
  // un <input type="datetime-local">.
  @IsString()
  startsAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  slots?: number;

  @Type(() => Number)
  @IsInt()
  createdBy!: number;
}
