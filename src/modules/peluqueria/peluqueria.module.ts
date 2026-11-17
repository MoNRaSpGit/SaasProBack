import { Module } from "@nestjs/common";
import { PeluqueriaAuthService } from "./peluqueria-auth.service";
import { PeluqueriaController } from "./peluqueria.controller";
import { PeluqueriaService } from "./peluqueria.service";

@Module({
  controllers: [PeluqueriaController],
  providers: [PeluqueriaService, PeluqueriaAuthService]
})
export class PeluqueriaModule {}
