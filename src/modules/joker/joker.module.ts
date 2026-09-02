import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../shared/database/database.module";
import { JokerController } from "./joker.controller";
import { JokerAccountService } from "./joker-account.service";
import { JokerAuthService } from "./joker-auth.service";
import { JokerChatService } from "./joker-chat.service";
import { JokerCourierService } from "./joker-courier.service";
import { JokerOrdersService } from "./joker-orders.service";
import { JokerPrintingService } from "./joker-printing.service";
import { JokerProductsService } from "./joker-products.service";
import { JokerReportingService } from "./joker-reporting.service";
import { JokerStockService } from "./joker-stock.service";

@Module({
  imports: [DatabaseModule],
  controllers: [JokerController],
  providers: [
    JokerProductsService,
    JokerStockService,
    JokerOrdersService,
    JokerCourierService,
    JokerAccountService,
    JokerReportingService,
    JokerPrintingService,
    JokerAuthService,
    JokerChatService
  ]
})
export class JokerModule {}
