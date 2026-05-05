import { Module } from "@nestjs/common";
import { NeonAuthGuard } from "./neon-auth.guard";
import { NeonController } from "./neon.controller";
import { NeonService } from "./neon.service";

@Module({
  controllers: [NeonController],
  providers: [NeonService, NeonAuthGuard]
})
export class NeonModule {}
