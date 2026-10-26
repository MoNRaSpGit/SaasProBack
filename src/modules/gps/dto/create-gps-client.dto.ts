import { IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

// Cliente cargado a mano desde la pestaña Clientes (27/10/2026). lat/lng
// vienen de "Buscar direccion" (GpsGeocodingService) y se confirman antes
// de guardar. Rango: departamento de Tacuarembo. Si no se encontro, va
// geoQuality "ninguna" sin lat/lng (cliente sin ubicacion).
export class CreateGpsClientDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(190)
  address!: string;

  @IsOptional()
  @IsNumber()
  @Min(-32.7)
  @Max(-30.9)
  lat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-57)
  @Max(-55)
  lng?: number;

  @IsIn(["puerta", "esquina", "calle", "ninguna"])
  geoQuality!: "puerta" | "esquina" | "calle" | "ninguna";
}

// "Actualizar ubicacion": siempre con una ubicacion encontrada.
export class UpdateGpsClientLocationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(190)
  address!: string;

  @IsNumber()
  @Min(-32.7)
  @Max(-30.9)
  lat!: number;

  @IsNumber()
  @Min(-57)
  @Max(-55)
  lng!: number;

  @IsIn(["puerta", "esquina", "calle"])
  geoQuality!: "puerta" | "esquina" | "calle";
}

export class GeocodeGpsAddressDto {
  @IsString()
  @MinLength(2)
  @MaxLength(190)
  address!: string;
}
