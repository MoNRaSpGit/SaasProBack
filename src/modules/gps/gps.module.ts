import { Module } from "@nestjs/common";
import { GpsAuthService } from "./gps-auth.service";
import { GpsDataService } from "./gps-data.service";
import { GpsGeocodingService } from "./gps-geocoding.service";
import { GpsRoutingService } from "./gps-routing.service";
import { GpsController } from "./gps.controller";

@Module({
  controllers: [GpsController],
  providers: [GpsAuthService, GpsDataService, GpsRoutingService, GpsGeocodingService]
})
export class GpsModule {}
