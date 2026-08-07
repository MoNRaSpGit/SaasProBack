import { IsNotEmpty, IsString } from "class-validator";

export class CreateCamisetasCheckoutDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;
}
