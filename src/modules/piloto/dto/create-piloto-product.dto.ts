import { IsIn, IsNumber, IsOptional, IsString, Min, MaxLength, MinLength } from "class-validator";

export class CreatePilotoProductDto {
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  barcode!: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  imageUrl?: string;

  @IsOptional()
  @IsIn(["active", "inactive"])
  status?: "active" | "inactive";
}
