import { Body, Controller, Post } from "@nestjs/common";
import { RecordJuezLoginDto } from "./dto/record-juez-login.dto";
import { JuezAuditService } from "./juez-audit.service";

@Controller("juez-audit")
export class JuezAuditController {
  constructor(private readonly juezAuditService: JuezAuditService) {}

  // El login de Juez es 100% del lado del frontend (2 cuentas fijas, sin
  // tabla de cuentas en el backend -- ver useAuthSession.ts), asi que no
  // hay otro punto donde registrar "se logueo" salvo que el frontend
  // avise con este endpoint, disparado y sin bloquear el login si falla.
  @Post("login")
  async recordLogin(@Body() dto: RecordJuezLoginDto) {
    if (dto.blocked) {
      await this.juezAuditService.record("login_blocked", dto.actor, `Intento de login con ${dto.actor}/${dto.actor} (bloqueado, señuelo)`);
    } else {
      await this.juezAuditService.record("login", dto.actor, `${dto.actor} inicio sesion`);
    }
    return { ok: true };
  }
}
