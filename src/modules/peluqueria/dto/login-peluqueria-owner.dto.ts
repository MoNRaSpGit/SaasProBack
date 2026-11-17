import { IsString, MaxLength, MinLength } from "class-validator";

export class LoginPeluqueriaOwnerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  username!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(100)
  password!: string;
}
