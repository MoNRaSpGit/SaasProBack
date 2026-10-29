import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../shared/database/database.module";
import { TamboController } from "./tambo.controller";
import { TamboService } from "./tambo.service";

@Module({
  imports: [DatabaseModule],
  controllers: [TamboController],
  providers: [TamboService]
})
export class TamboModule {}
