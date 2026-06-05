import { IsString, MaxLength, MinLength } from "class-validator";

export class ChangePasswordDto {
  @IsString()
  @MinLength(4)
  @MaxLength(72)
  currentPassword!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(72)
  newPassword!: string;
}
