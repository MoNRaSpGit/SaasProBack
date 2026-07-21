import { Module } from "@nestjs/common";
import { JuezAuthModule } from "./auth/juez-auth.module";
import { JuezPlayersModule } from "./players/juez-players.module";

@Module({
  imports: [JuezAuthModule, JuezPlayersModule]
})
export class JuezModule {}
