import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../shared/database/database.module";
import { JokerController } from "./joker.controller";
import { JokerService } from "./joker.service";

@Module({
  imports: [DatabaseModule],
  controllers: [JokerController],
  providers: [JokerService]
})
export class JokerModule {}
