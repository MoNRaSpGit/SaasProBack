import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../shared/database/database.module";
import { AlamcenController } from "./alamcen.controller";
import { AlamcenService } from "./alamcen.service";

@Module({
  imports: [DatabaseModule],
  controllers: [AlamcenController],
  providers: [AlamcenService]
})
export class AlamcenModule {}
