import { Controller, Get, UseGuards } from "@nestjs/common";
import { CapabilityGuard } from "../../shared/authz/capability.guard";
import { RequireCapability } from "../../shared/authz/require-capability.decorator";
import { CurrentNeonUser } from "./current-neon-user.decorator";
import { NeonAuthGuard } from "./neon-auth.guard";
import { NeonService } from "./neon.service";
import { NeonRequestUser } from "./neon.types";

@Controller("neon")
@UseGuards(NeonAuthGuard, CapabilityGuard)
export class NeonController {
  constructor(private readonly neonService: NeonService) {}

  @Get("status")
  @RequireCapability("neon.shell.read")
  getStatus(@CurrentNeonUser() currentUser: NeonRequestUser) {
    return this.neonService.getStatus(currentUser);
  }
}
