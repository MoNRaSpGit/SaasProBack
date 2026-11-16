import { Module } from "@nestjs/common";
import { NoticesModule } from "../notices/notices.module";
import { GymController } from "./gym.controller";
import { GymService } from "./gym.service";
import { GymAuthService } from "./gym-auth.service";

@Module({
  imports: [NoticesModule],
  controllers: [GymController],
  providers: [GymService, GymAuthService]
})
export class GymModule {}
