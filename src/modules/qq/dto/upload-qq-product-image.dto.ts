import { IsString, MaxLength } from "class-validator";

export class UploadQqProductImageDto {
  // Data URI base64 ("data:image/jpeg;base64,...") -- el frontend ya la
  // redimensiono/comprimio antes de mandarla (ver
  // ProductFormModal#resizeImageFile), asi que el limite generoso es solo
  // para no cortar de mas si algun dia se sube algo un poco mas pesado.
  @IsString()
  @MaxLength(4_000_000)
  dataUri!: string;
}
