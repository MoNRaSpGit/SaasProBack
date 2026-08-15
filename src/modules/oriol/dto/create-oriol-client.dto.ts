import { IsOptional, IsString, MaxLength } from "class-validator";

export class CreateOriolClientDto {
  @IsString()
  @MaxLength(120)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  telefono?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  cedula?: string;
}
