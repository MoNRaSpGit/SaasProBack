import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../shared/database/database.module";
import { QqController } from "./qq.controller";
import { QqProductsService } from "./qq-products.service";

@Module({
  imports: [DatabaseModule],
  controllers: [QqController],
  providers: [QqProductsService]
})
export class QqModule {}
