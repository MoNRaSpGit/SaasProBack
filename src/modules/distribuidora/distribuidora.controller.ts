import { Controller, Get, UseGuards } from "@nestjs/common";
import { CurrentDistribuidoraUser } from "./current-distribuidora-user.decorator";
import { DistribuidoraAuthGuard } from "./distribuidora-auth.guard";
import { DistribuidoraService } from "./distribuidora.service";
import { DistribuidoraRequestUser } from "./distribuidora.types";

@Controller("distribuidora")
@UseGuards(DistribuidoraAuthGuard)
export class DistribuidoraController {
  constructor(private readonly distribuidoraService: DistribuidoraService) {}

  @Get("status")
  getStatus(@CurrentDistribuidoraUser() currentUser: DistribuidoraRequestUser) {
    return this.distribuidoraService.getStatus(currentUser);
  }

  @Get("admin/status")
  getAdminStatus(@CurrentDistribuidoraUser() currentUser: DistribuidoraRequestUser) {
    return this.distribuidoraService.getAdminStatus(currentUser);
  }
}
