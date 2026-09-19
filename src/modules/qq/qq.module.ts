import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../shared/database/database.module";
import { QqAuditService } from "./qq-audit.service";
import { QqAuthController } from "./qq-auth.controller";
import { QqAuthService } from "./qq-auth.service";
import { QqCarouselService } from "./qq-carousel.service";
import { QqClientsService } from "./qq-clients.service";
import { QqController } from "./qq.controller";
import { QqProductsService } from "./qq-products.service";

@Module({
  imports: [DatabaseModule],
  controllers: [QqController, QqAuthController],
  providers: [QqProductsService, QqAuthService, QqCarouselService, QqClientsService, QqAuditService]
})
export class QqModule {}
