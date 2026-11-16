import { Module } from "@nestjs/common";
import { CloudinaryModule } from "../../shared/cloudinary/cloudinary.module";
import { DatabaseModule } from "../../shared/database/database.module";
import { NoticesModule } from "../notices/notices.module";
import { GabyAuditService } from "./gaby-audit.service";
import { GabyClientsService } from "./gaby-clients.service";
import { GabyReportsService } from "./gaby-reports.service";
import { GabyController } from "./gaby.controller";
import { GabyService } from "./gaby.service";

@Module({
  imports: [DatabaseModule, CloudinaryModule, NoticesModule],
  controllers: [GabyController],
  providers: [GabyService, GabyAuditService, GabyClientsService, GabyReportsService]
})
export class GabyModule {}
