import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../shared/database/database.module";
import { CarnetController } from "./carnet.controller";
import { CarnetService } from "./carnet.service";

@Module({
  imports: [DatabaseModule],
  controllers: [CarnetController],
  providers: [CarnetService]
})
export class CarnetModule {}
