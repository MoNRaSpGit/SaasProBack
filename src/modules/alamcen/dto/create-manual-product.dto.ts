import { IsNumber, IsString, Min } from "class-validator";

export class CreateManualProductDto {
  @IsString()
  barcode!: string;

  @IsNumber()
  @Min(0.01)
  price!: number;
}
