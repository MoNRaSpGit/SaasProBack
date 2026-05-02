import { Module } from "@nestjs/common";
import { PosController } from "./pos.controller";
import { PosAuthGuard } from "./pos-auth.guard";
import { PosService } from "./pos.service";

@Module({
  controllers: [PosController],
  providers: [PosService, PosAuthGuard]
})
export class PosModule {}
