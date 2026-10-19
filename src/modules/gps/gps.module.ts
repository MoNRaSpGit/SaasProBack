import { Module } from "@nestjs/common";
import { GpsAuthService } from "./gps-auth.service";
import { GpsDataService } from "./gps-data.service";
import { GpsController } from "./gps.controller";

@Module({
  controllers: [GpsController],
  providers: [GpsAuthService, GpsDataService]
})
export class GpsModule {}
