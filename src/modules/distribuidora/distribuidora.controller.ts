import { Controller, Get, UseGuards } from "@nestjs/common";
import { CapabilityGuard } from "../../shared/authz/capability.guard";
import { RequireCapability } from "../../shared/authz/require-capability.decorator";
import { CurrentDistribuidoraUser } from "./current-distribuidora-user.decorator";
import { DistribuidoraAuthGuard } from "./distribuidora-auth.guard";
import { DistribuidoraService } from "./distribuidora.service";
import { DistribuidoraRequestUser } from "./distribuidora.types";

@Controller("distribuidora")
@UseGuards(DistribuidoraAuthGuard)
export class DistribuidoraController {
  constructor(private readonly distribuidoraService: DistribuidoraService) {}

  @RequireCapability("distribuidora.shell.read")
  @UseGuards(CapabilityGuard)
  @Get("status")
  getStatus(@CurrentDistribuidoraUser() currentUser: DistribuidoraRequestUser) {
    return this.distribuidoraService.getStatus(currentUser);
  }

  @RequireCapability("distribuidora.admin.read")
  @UseGuards(CapabilityGuard)
  @Get("admin/status")
  getAdminStatus(@CurrentDistribuidoraUser() currentUser: DistribuidoraRequestUser) {
    return this.distribuidoraService.getAdminStatus(currentUser);
  }
}
