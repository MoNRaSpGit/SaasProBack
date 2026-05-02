import { IsOptional, IsString, MaxLength } from "class-validator";

export class CreateCamionesPlaceDto {
  @IsString()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}
