import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

// No hardcodeamos la lista de usuarios validos (admin/usuario/camila/...)
// -- quedaria desincronizado cada vez que se agrega una cuenta nueva en
// useAuthSession.ts (10/10/2026, bug encontrado al agregar "camila").
export class RecordJuezLoginDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  actor!: string;

  // Señuelo admin/admin (20/10/2026, pedido explicito): ese intento nunca
  // deja entrar, pero igual queremos saber si alguien lo probo.
  @IsOptional()
  @IsBoolean()
  blocked?: boolean;
}
