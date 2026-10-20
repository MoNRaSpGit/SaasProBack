import { Module } from "@nestjs/common";
import { AlquilerController } from "./alquiler.controller";
import { AlquilerService } from "./alquiler.service";

@Module({
  controllers: [AlquilerController],
  providers: [AlquilerService]
})
export class AlquilerModule {}
