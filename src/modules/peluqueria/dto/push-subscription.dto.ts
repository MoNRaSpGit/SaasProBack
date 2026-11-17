import { Type } from "class-transformer";
import { IsString, IsUrl, Matches, MaxLength, ValidateNested } from "class-validator";

class PushKeysDto {
  @IsString()
  @MaxLength(255)
  p256dh!: string;

  @IsString()
  @MaxLength(255)
  auth!: string;
}

export class PeluqueriaPushSubscriptionDto {
  // Solo https: los servicios de push (Google, Mozilla, Apple) son siempre https.
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(1000)
  @Matches(/^https:\/\//)
  endpoint!: string;

  @ValidateNested()
  @Type(() => PushKeysDto)
  keys!: PushKeysDto;
}

export class PeluqueriaPushEndpointDto {
  @IsString()
  @MaxLength(1000)
  endpoint!: string;
}
