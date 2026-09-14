import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../shared/database/database.module";
import { QqAuthController } from "./qq-auth.controller";
import { QqAuthService } from "./qq-auth.service";
import { QqController } from "./qq.controller";
import { QqProductsService } from "./qq-products.service";

@Module({
  imports: [DatabaseModule],
  controllers: [QqController, QqAuthController],
  providers: [QqProductsService, QqAuthService]
})
export class QqModule {}
