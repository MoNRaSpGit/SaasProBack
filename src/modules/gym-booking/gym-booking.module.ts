import { Module } from "@nestjs/common";
import { GymAuthService } from "../gym/gym-auth.service";
import { GymBookingController } from "./gym-booking.controller";
import { GymBookingService } from "./gym-booking.service";

@Module({
  controllers: [GymBookingController],
  providers: [GymBookingService, GymAuthService]
})
export class GymBookingModule {}
