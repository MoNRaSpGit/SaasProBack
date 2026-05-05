import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateNeonClientDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}
