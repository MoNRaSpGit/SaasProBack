import { Module } from "@nestjs/common";
import { CloudinaryModule } from "../../shared/cloudinary/cloudinary.module";
import { DatabaseModule } from "../../shared/database/database.module";
import { PilotoAuditService } from "./piloto-audit.service";
import { PilotoClientsService } from "./piloto-clients.service";
import { PilotoController } from "./piloto.controller";
import { PilotoPriceEntriesService } from "./piloto-price-entries.service";
import { PilotoPrintingService } from "./piloto-printing.service";
import { PilotoService } from "./piloto.service";
import { PilotoTicketsService } from "./piloto-tickets.service";

@Module({
  imports: [DatabaseModule, CloudinaryModule],
  controllers: [PilotoController],
  providers: [PilotoService, PilotoAuditService, PilotoPrintingService, PilotoPriceEntriesService, PilotoClientsService, PilotoTicketsService]
})
export class PilotoModule {}
