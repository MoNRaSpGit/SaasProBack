import { IsString, MaxLength, MinLength } from "class-validator";

export class LoginRopaUserDto {
  // (16/11/2026) Usuario o email: el admin entra con "admin" a secas. El
  // registro de clientes sigue exigiendo email (register-ropa-user.dto.ts).
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  email!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password!: string;
}
