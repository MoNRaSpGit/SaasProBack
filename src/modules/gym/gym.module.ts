import { Module } from "@nestjs/common";
import { GymController } from "./gym.controller";
import { GymService } from "./gym.service";
import { GymAuthService } from "./gym-auth.service";

@Module({
  controllers: [GymController],
  providers: [GymService, GymAuthService]
})
export class GymModule {}
