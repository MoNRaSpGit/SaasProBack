import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../shared/database/database.module";
import { CamisetasController } from "./camisetas.controller";
import { CamisetasService } from "./camisetas.service";

@Module({
  imports: [DatabaseModule],
  controllers: [CamisetasController],
  providers: [CamisetasService]
})
export class CamisetasModule {}
