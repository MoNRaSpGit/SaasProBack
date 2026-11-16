import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../shared/database/database.module";
import { RopaAuditService } from "./ropa-audit.service";
import { RopaAuthController } from "./ropa-auth.controller";
import { RopaAuthService } from "./ropa-auth.service";
import { RopaCarouselService } from "./ropa-carousel.service";
import { RopaClientsService } from "./ropa-clients.service";
import { RopaController } from "./ropa.controller";
import { RopaDiscountService } from "./ropa-discount.service";
import { RopaProductsService } from "./ropa-products.service";

@Module({
  imports: [DatabaseModule],
  controllers: [RopaController, RopaAuthController],
  providers: [RopaProductsService, RopaAuthService, RopaCarouselService, RopaClientsService, RopaAuditService, RopaDiscountService]
})
export class RopaModule {}
