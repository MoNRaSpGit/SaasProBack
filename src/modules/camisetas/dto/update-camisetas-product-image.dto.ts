import { IsNotEmpty, IsString } from "class-validator";

export class UpdateCamisetasProductImageDto {
  // Data URI base64 (data:<mime>;base64,<payload>). El frontend ya la
  // comprime/redimensiona en el navegador antes de mandarla.
  @IsString()
  @IsNotEmpty()
  image!: string;
}
