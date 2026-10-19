import { IsString, MaxLength, MinLength } from "class-validator";

export class LoginGpsPasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password!: string;
}
