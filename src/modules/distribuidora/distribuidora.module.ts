import { Module } from "@nestjs/common";
import { DistribuidoraController } from "./distribuidora.controller";
import { DistribuidoraService } from "./distribuidora.service";

@Module({
  controllers: [DistribuidoraController],
  providers: [DistribuidoraService]
})
export class DistribuidoraModule {}
