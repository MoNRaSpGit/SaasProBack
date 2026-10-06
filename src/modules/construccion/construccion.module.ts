import { Module } from "@nestjs/common";
import { ConstruccionController } from "./construccion.controller";
import { ConstruccionService } from "./construccion.service";

@Module({
  controllers: [ConstruccionController],
  providers: [ConstruccionService]
})
export class ConstruccionModule {}
