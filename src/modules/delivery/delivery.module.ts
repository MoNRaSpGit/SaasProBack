import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../shared/database/database.module";
import { DeliveryController } from "./delivery.controller";
import { DeliveryService } from "./delivery.service";

@Module({
  imports: [DatabaseModule],
  controllers: [DeliveryController],
  providers: [DeliveryService]
})
export class DeliveryModule {}
