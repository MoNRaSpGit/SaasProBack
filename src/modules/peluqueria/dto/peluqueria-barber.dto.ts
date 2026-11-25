import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreatePeluqueriaBarberDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name!: string;
}

export class UpdatePeluqueriaBarberDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
