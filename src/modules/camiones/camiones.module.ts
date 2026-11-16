import { Module } from "@nestjs/common";
import { CamionesAuditService } from "./camiones-audit.service";
import { CamionesAuthController } from "./camiones-auth.controller";
import { CamionesAuthGuard } from "./camiones-auth.guard";
import { CamionesAuthService } from "./camiones-auth.service";
import { CamionesController } from "./camiones.controller";
import { CamionesService } from "./camiones.service";

@Module({
  controllers: [CamionesAuthController, CamionesController],
  providers: [CamionesService, CamionesAuthService, CamionesAuthGuard, CamionesAuditService]
})
export class CamionesModule {}
