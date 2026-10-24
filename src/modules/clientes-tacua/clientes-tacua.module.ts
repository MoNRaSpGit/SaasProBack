import { Module } from "@nestjs/common";
import { ClientesTacuaController } from "./clientes-tacua.controller";
import { ClientesTacuaService } from "./clientes-tacua.service";

@Module({
  controllers: [ClientesTacuaController],
  providers: [ClientesTacuaService]
})
export class ClientesTacuaModule {}
