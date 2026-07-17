import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../shared/database/database.module";
import { PilotoController } from "./piloto.controller";
import { PilotoService } from "./piloto.service";

@Module({
  imports: [DatabaseModule],
  controllers: [PilotoController],
  providers: [PilotoService]
})
export class PilotoModule {}
