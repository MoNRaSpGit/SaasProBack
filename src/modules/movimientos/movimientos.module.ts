import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../shared/database/database.module";
import { MovimientosAuthGuard } from "./movimientos-auth.guard";
import { MovimientosController } from "./movimientos.controller";
import { MovimientosService } from "./movimientos.service";

@Module({
  imports: [DatabaseModule],
  controllers: [MovimientosController],
  providers: [MovimientosService, MovimientosAuthGuard]
})
export class MovimientosModule {}
