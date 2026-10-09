import { Module } from "@nestjs/common";
import { JuezAuditModule } from "./audit/juez-audit.module";
import { JuezAuthModule } from "./auth/juez-auth.module";
import { JuezMatchesModule } from "./matches/juez-matches.module";
import { JuezPlayersModule } from "./players/juez-players.module";
import { JuezTeamsModule } from "./teams/juez-teams.module";

@Module({
  imports: [JuezAuthModule, JuezMatchesModule, JuezPlayersModule, JuezTeamsModule, JuezAuditModule]
})
export class JuezModule {}
