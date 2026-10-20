import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  MaxLength,
  MinLength,
  ValidateNested
} from "class-validator";

export class TallerLaborItemDto {
  @IsIn(["chapa", "pintura", "otro"])
  category!: "chapa" | "pintura" | "otro";

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  description!: string;

  @IsNumber()
  @Min(0)
  price!: number;
}

export class TallerQuotePartDto {
  @IsInt()
  @IsPositive()
  stockId!: number;

  @IsNumber()
  @Min(0.01)
  quantity!: number;
}

export class CreateTallerQuoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  vehicleInfo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  clientName?: string;

  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => TallerLaborItemDto)
  laborItems!: TallerLaborItemDto[];

  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => TallerQuotePartDto)
  parts!: TallerQuotePartDto[];
}
