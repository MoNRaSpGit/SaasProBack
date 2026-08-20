import { Module } from "@nestjs/common";
import { JuezAuthModule } from "./auth/juez-auth.module";
import { JuezPlayersModule } from "./players/juez-players.module";
import { JuezTeamsModule } from "./teams/juez-teams.module";

@Module({
  imports: [JuezAuthModule, JuezPlayersModule, JuezTeamsModule]
})
export class JuezModule {}
