import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../shared/database/database.module";
import { LogiclabController } from "./logiclab.controller";
import { LogiclabVisitsService } from "./logiclab-visits.service";

@Module({
  imports: [DatabaseModule],
  controllers: [LogiclabController],
  providers: [LogiclabVisitsService]
})
export class LogiclabModule {}
