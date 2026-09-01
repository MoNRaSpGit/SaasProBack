import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../shared/database/database.module";
import { EjemploController } from "./ejemplo.controller";
import { EjemploClientsService } from "./ejemplo-clients.service";
import { EjemploPrintingService } from "./ejemplo-printing.service";
import { EjemploProductsService } from "./ejemplo-products.service";
import { EjemploSalesService } from "./ejemplo-sales.service";

@Module({
  imports: [DatabaseModule],
  controllers: [EjemploController],
  providers: [EjemploProductsService, EjemploClientsService, EjemploSalesService, EjemploPrintingService]
})
export class EjemploModule {}
