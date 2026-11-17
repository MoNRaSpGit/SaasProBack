import { Module } from "@nestjs/common";
import { PeluqueriaController } from "./peluqueria.controller";
import { PeluqueriaPushService } from "./peluqueria-push.service";
import { PeluqueriaService } from "./peluqueria.service";

@Module({
  controllers: [PeluqueriaController],
  providers: [PeluqueriaService, PeluqueriaPushService]
})
export class PeluqueriaModule {}
