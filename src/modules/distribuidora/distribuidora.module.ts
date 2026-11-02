import { Module } from "@nestjs/common";
import { DistribuidoraAuthService } from "./distribuidora-auth.service";
import { DistribuidoraController } from "./distribuidora.controller";
import { DistribuidoraService } from "./distribuidora.service";

@Module({
  controllers: [DistribuidoraController],
  providers: [DistribuidoraService, DistribuidoraAuthService]
})
export class DistribuidoraModule {}
