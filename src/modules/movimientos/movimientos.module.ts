import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../shared/database/database.module";
import { MovimientosController } from "./movimientos.controller";
import { MovimientosService } from "./movimientos.service";

@Module({
  imports: [DatabaseModule],
  controllers: [MovimientosController],
  providers: [MovimientosService]
})
export class MovimientosModule {}
