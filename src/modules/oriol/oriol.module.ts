import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../shared/database/database.module";
import { OriolController } from "./oriol.controller";
import { OriolClientsService } from "./oriol-clients.service";
import { OriolConfigService } from "./oriol-config.service";
import { OriolPanelService } from "./oriol-panel.service";
import { OriolPaymentsService } from "./oriol-payments.service";
import { OriolProductsService } from "./oriol-products.service";
import { OriolSalesService } from "./oriol-sales.service";

@Module({
  imports: [DatabaseModule],
  controllers: [OriolController],
  providers: [
    OriolProductsService,
    OriolSalesService,
    OriolClientsService,
    OriolPaymentsService,
    OriolConfigService,
    OriolPanelService
  ]
})
export class OriolModule {}
