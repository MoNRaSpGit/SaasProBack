import { IsString, MinLength } from "class-validator";

export class ConfirmJuezEmailDto {
  @IsString()
  @MinLength(16)
  token!: string;
}
