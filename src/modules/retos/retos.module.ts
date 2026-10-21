import { Module } from "@nestjs/common";
import { RetosController } from "./retos.controller";
import { RetosService } from "./retos.service";

@Module({
  controllers: [RetosController],
  providers: [RetosService]
})
export class RetosModule {}
