import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../shared/database/database.module";
import { PlanillaController } from "./planilla.controller";
import { PlanillaService } from "./planilla.service";

@Module({
  imports: [DatabaseModule],
  controllers: [PlanillaController],
  providers: [PlanillaService]
})
export class PlanillaModule {}
