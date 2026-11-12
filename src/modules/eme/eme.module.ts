import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../shared/database/database.module";
import { EmeController } from "./eme.controller";
import { EmeService } from "./eme.service";

@Module({
  imports: [DatabaseModule],
  controllers: [EmeController],
  providers: [EmeService]
})
export class EmeModule {}
