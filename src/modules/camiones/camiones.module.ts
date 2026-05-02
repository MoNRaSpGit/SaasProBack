import { Module } from "@nestjs/common";
import { CamionesAuthGuard } from "./camiones-auth.guard";
import { CamionesController } from "./camiones.controller";
import { CamionesService } from "./camiones.service";

@Module({
  controllers: [CamionesController],
  providers: [CamionesService, CamionesAuthGuard]
})
export class CamionesModule {}
