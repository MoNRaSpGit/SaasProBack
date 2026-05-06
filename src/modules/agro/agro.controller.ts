import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { CapabilityGuard } from "../../shared/authz/capability.guard";
import { RequireCapability } from "../../shared/authz/require-capability.decorator";
import { CurrentAgroUser } from "./current-agro-user.decorator";
import { AgroAuthGuard } from "./agro-auth.guard";
import { AgroService } from "./agro.service";
import { AgroRequestUser } from "./agro.types";
import { SaveAgroDiscoveryResponseDto } from "./dto/save-agro-discovery-response.dto";

@Controller("agro")
@UseGuards(AgroAuthGuard)
export class AgroController {
  constructor(private readonly agroService: AgroService) {}

  @RequireCapability("agro.shell.read")
  @UseGuards(CapabilityGuard)
  @Get("status")
  getStatus(@CurrentAgroUser() currentUser: AgroRequestUser) {
    return this.agroService.getStatus(currentUser);
  }

  @RequireCapability("agro.discovery.read")
  @UseGuards(CapabilityGuard)
  @Get("discovery/latest")
  getLatestDiscoveryResponse(@CurrentAgroUser() currentUser: AgroRequestUser) {
    return this.agroService.getLatestDiscoveryResponse(currentUser);
  }

  @RequireCapability("agro.discovery.write")
  @UseGuards(CapabilityGuard)
  @Post("discovery")
  saveDiscoveryResponse(
    @CurrentAgroUser() currentUser: AgroRequestUser,
    @Body() dto: SaveAgroDiscoveryResponseDto
  ) {
    return this.agroService.saveDiscoveryResponse(currentUser, dto);
  }
}
