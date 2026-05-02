import { Global, Module } from "@nestjs/common";
import { CapabilityGuard } from "./capability.guard";

@Global()
@Module({
  providers: [CapabilityGuard],
  exports: [CapabilityGuard]
})
export class AuthzModule {}
