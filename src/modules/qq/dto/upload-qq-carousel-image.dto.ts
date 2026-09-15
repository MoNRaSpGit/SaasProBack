import { IsString, MaxLength } from "class-validator";

export class UploadQqCarouselImageDto {
  // Data URI base64 -- el frontend ya la redimensiono/comprimio antes de
  // mandarla (ver qq.imageResize.ts#resizeBackgroundImageFile). Limite
  // mas generoso que el de producto porque una foto de fondo (ancha,
  // paisaje) pesa mas que el logo cuadrado de una tarjeta.
  @IsString()
  @MaxLength(8_000_000)
  dataUri!: string;
}
