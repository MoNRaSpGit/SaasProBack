import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../shared/database/database.module";
import { NoticesModule } from "../notices/notices.module";
import { EmeController } from "./eme.controller";
import { EmeService } from "./eme.service";
import { EmeAuthGuard, EmeAuthService } from "./eme-auth.service";

@Module({
  imports: [DatabaseModule, NoticesModule],
  controllers: [EmeController],
  providers: [EmeService, EmeAuthService, EmeAuthGuard]
})
export class EmeModule {}
