import { IsString, MaxLength, MinLength } from "class-validator";

export class LoginGpsUserDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  username!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password!: string;
}
