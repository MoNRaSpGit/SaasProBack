import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from "class-validator";

// El vendedor solo manda QUE producto y CUANTO -- nombre y precio los
// pone el backend desde el catalogo, asi el total no depende de lo que
// tenga cargado (o desactualizado) el celular.
export class DistribuidoraOrderItemDto {
  @Type(() => Number)
  @IsInt()
  productId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9999)
  quantity!: number;
}

export class CreateDistribuidoraOrderDto {
  @Type(() => Number)
  @IsInt()
  clientId!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => DistribuidoraOrderItemDto)
  items!: DistribuidoraOrderItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
