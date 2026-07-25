import { IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateJokerSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  storeName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  phone?: string;
}
