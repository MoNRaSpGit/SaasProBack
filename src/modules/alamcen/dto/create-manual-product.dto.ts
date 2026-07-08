import { IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateManualProductDto {
  @IsString()
  barcode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  name?: string;

  @IsNumber()
  @Min(0.01)
  price!: number;
}
