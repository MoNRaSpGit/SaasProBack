import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../shared/database/database.module";
import { CarnetAdminGuard } from "./carnet-admin.guard";
import { CarnetController } from "./carnet.controller";
import { CarnetService } from "./carnet.service";

@Module({
  imports: [DatabaseModule],
  controllers: [CarnetController],
  providers: [CarnetService, CarnetAdminGuard]
})
export class CarnetModule {}
