import { Module } from "@nestjs/common";
import { PeluqueriaController } from "./peluqueria.controller";
import { PeluqueriaService } from "./peluqueria.service";

@Module({
  controllers: [PeluqueriaController],
  providers: [PeluqueriaService]
})
export class PeluqueriaModule {}
