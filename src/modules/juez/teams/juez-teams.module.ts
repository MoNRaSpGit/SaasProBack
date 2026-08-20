import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../../shared/database/database.module";
import { JuezTeamsController } from "./juez-teams.controller";
import { JuezTeamsService } from "./juez-teams.service";

@Module({
  imports: [DatabaseModule],
  controllers: [JuezTeamsController],
  providers: [JuezTeamsService]
})
export class JuezTeamsModule {}
