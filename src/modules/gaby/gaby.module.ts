import { Module } from "@nestjs/common";
import { CloudinaryModule } from "../../shared/cloudinary/cloudinary.module";
import { DatabaseModule } from "../../shared/database/database.module";
import { GabyAuditService } from "./gaby-audit.service";
import { GabyClientsService } from "./gaby-clients.service";
import { GabyController } from "./gaby.controller";
import { GabyService } from "./gaby.service";

@Module({
  imports: [DatabaseModule, CloudinaryModule],
  controllers: [GabyController],
  providers: [GabyService, GabyAuditService, GabyClientsService]
})
export class GabyModule {}
