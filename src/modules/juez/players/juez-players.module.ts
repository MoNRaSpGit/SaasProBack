import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../../shared/database/database.module";
import { JuezPlayersController } from "./juez-players.controller";
import { JuezPlayersService } from "./juez-players.service";

@Module({
  imports: [DatabaseModule],
  controllers: [JuezPlayersController],
  providers: [JuezPlayersService]
})
export class JuezPlayersModule {}
