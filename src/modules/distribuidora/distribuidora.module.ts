import { Module } from "@nestjs/common";
import { DistribuidoraAuthGuard } from "./distribuidora-auth.guard";
import { DistribuidoraController } from "./distribuidora.controller";
import { DistribuidoraService } from "./distribuidora.service";

@Module({
  controllers: [DistribuidoraController],
  providers: [DistribuidoraService, DistribuidoraAuthGuard]
})
export class DistribuidoraModule {}
