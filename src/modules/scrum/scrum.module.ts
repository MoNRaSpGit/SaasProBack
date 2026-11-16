import { Module } from "@nestjs/common";
import { NoticesModule } from "../notices/notices.module";
import { ScrumController } from "./scrum.controller";
import { ScrumService } from "./scrum.service";

@Module({
  imports: [NoticesModule],
  controllers: [ScrumController],
  providers: [ScrumService]
})
export class ScrumModule {}
