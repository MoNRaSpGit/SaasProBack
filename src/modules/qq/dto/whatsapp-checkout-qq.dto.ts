import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested
} from "class-validator";

export class WhatsAppCheckoutItemDto {
  @IsInt()
  @Min(1)
  productId!: number;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsIn(["cuenta", "perfil"])
  variant!: "cuenta" | "perfil";

  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000)
  unitPrice!: number;
}

// Lo que manda el navegador cuando alguien toca "Comprar por WhatsApp" --
// ver QqController#reportWhatsAppCheckout. Es una intencion de compra
// declarada por el cliente (no una venta confirmada), asi que se valida
// por forma y tamaño pero no se cree como dato "duro".
export class WhatsAppCheckoutDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => WhatsAppCheckoutItemDto)
  items!: WhatsAppCheckoutItemDto[];

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10_000_000)
  total!: number;
}
