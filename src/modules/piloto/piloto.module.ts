import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../shared/database/database.module";
import { PilotoAuditService } from "./piloto-audit.service";
import { PilotoController } from "./piloto.controller";
import { PilotoPrintingService } from "./piloto-printing.service";
import { PilotoService } from "./piloto.service";

@Module({
  imports: [DatabaseModule],
  controllers: [PilotoController],
  providers: [PilotoService, PilotoAuditService, PilotoPrintingService]
})
export class PilotoModule {}
