import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../shared/database/database.module";
import { AlamcenAuthGuard } from "./alamcen-auth.guard";
import { AlamcenController } from "./alamcen.controller";
import { AlamcenService } from "./alamcen.service";

@Module({
  imports: [DatabaseModule],
  controllers: [AlamcenController],
  providers: [AlamcenService, AlamcenAuthGuard]
})
export class AlamcenModule {}
