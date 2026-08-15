import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../shared/database/database.module";
import { OriolApiKeyGuard } from "./oriol-api-key.guard";
import { OriolController } from "./oriol.controller";
import { OriolService } from "./oriol.service";

@Module({
  imports: [DatabaseModule],
  controllers: [OriolController],
  providers: [OriolService, OriolApiKeyGuard]
})
export class OriolModule {}
