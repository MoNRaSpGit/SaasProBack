import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../shared/database/database.module";
import { OriolController } from "./oriol.controller";
import { OriolService } from "./oriol.service";

@Module({
  imports: [DatabaseModule],
  controllers: [OriolController],
  providers: [OriolService]
})
export class OriolModule {}
