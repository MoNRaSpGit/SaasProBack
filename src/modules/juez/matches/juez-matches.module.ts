import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../../shared/database/database.module";
import { JuezMatchesController } from "./juez-matches.controller";
import { JuezMatchesService } from "./juez-matches.service";

@Module({
  imports: [DatabaseModule],
  controllers: [JuezMatchesController],
  providers: [JuezMatchesService]
})
export class JuezMatchesModule {}
