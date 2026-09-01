import { IsString, MinLength } from "class-validator";

export class SignQzRequestDto {
  @IsString()
  @MinLength(1)
  toSign!: string;
}
