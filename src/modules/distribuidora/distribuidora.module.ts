import { Module } from "@nestjs/common";
import { NoticesModule } from "../notices/notices.module";
import { DistribuidoraAuthService } from "./distribuidora-auth.service";
import { DistribuidoraController } from "./distribuidora.controller";
import { DistribuidoraService } from "./distribuidora.service";

@Module({
  imports: [NoticesModule],
  controllers: [DistribuidoraController],
  providers: [DistribuidoraService, DistribuidoraAuthService]
})
export class DistribuidoraModule {}
