import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { DeliveryEventStatus } from "../delivery.types";

const STATUSES: DeliveryEventStatus[] = ["abierto", "cerrado", "cancelado"];

export class UpdateDeliveryEventDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  place?: string;

  @IsOptional()
  @IsString()
  startsAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  slots?: number;

  @IsOptional()
  @IsIn(STATUSES)
  status?: DeliveryEventStatus;
}
