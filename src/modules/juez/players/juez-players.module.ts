import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../../shared/database/database.module";
import { JuezAuditModule } from "../audit/juez-audit.module";
import { JuezPlayersController } from "./juez-players.controller";
import { JuezPlayersService } from "./juez-players.service";

@Module({
  imports: [DatabaseModule, JuezAuditModule],
  controllers: [JuezPlayersController],
  providers: [JuezPlayersService]
})
export class JuezPlayersModule {}
