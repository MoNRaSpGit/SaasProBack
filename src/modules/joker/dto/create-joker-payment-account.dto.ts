import { IsString, MaxLength, MinLength } from "class-validator";

export class CreateJokerPaymentAccountDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  label!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  ownerName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  accountInfo!: string;
}
