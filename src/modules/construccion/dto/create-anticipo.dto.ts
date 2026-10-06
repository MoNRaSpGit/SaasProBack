import { IsInt, IsNumber, IsOptional, IsString, Matches, MaxLength, Min } from "class-validator";

export class CreateAnticipoDto {
  @IsInt()
  personalId!: number;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fecha!: string;

  @IsNumber()
  @Min(0.01)
  monto!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  nota?: string;
}
