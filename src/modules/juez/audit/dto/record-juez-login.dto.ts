import { IsString, MaxLength, MinLength } from "class-validator";

// No hardcodeamos la lista de usuarios validos (admin/usuario/camila/...)
// -- quedaria desincronizado cada vez que se agrega una cuenta nueva en
// useAuthSession.ts (10/10/2026, bug encontrado al agregar "camila").
export class RecordJuezLoginDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  actor!: string;
}
