import { Body, Controller, Get, Post, Put, UseGuards } from "@nestjs/common";
import { CapabilityGuard } from "../../shared/authz/capability.guard";
import { RequireCapability } from "../../shared/authz/require-capability.decorator";
import { CurrentAgroUser } from "./current-agro-user.decorator";
import { AgroAuthGuard } from "./agro-auth.guard";
import { AgroService } from "./agro.service";
import { AgroRequestUser } from "./agro.types";
import { SaveAgroDiscoveryResponseDto } from "./dto/save-agro-discovery-response.dto";
import { SaveAgroWorkspaceDto } from "./dto/save-agro-workspace.dto";

@Controller("agro")
export class AgroController {
  constructor(private readonly agroService: AgroService) {}

  @Get("workspace/public")
  getPublicWorkspace() {
    return this.agroService.getPublicWorkspace();
  }

  @Put("workspace/public")
  savePublicWorkspace(@Body() dto: SaveAgroWorkspaceDto) {
    return this.agroService.savePublicWorkspace(dto);
  }

  @UseGuards(AgroAuthGuard, CapabilityGuard)
  @RequireCapability("agro.shell.read")
  @Get("workspace")
  getWorkspace(@CurrentAgroUser() currentUser: AgroRequestUser) {
    return this.agroService.getWorkspace(currentUser);
  }

  @UseGuards(AgroAuthGuard, CapabilityGuard)
  @RequireCapability("agro.discovery.write")
  @Put("workspace")
  saveWorkspace(@CurrentAgroUser() currentUser: AgroRequestUser, @Body() dto: SaveAgroWorkspaceDto) {
    return this.agroService.saveWorkspace(currentUser, dto);
  }

  @UseGuards(AgroAuthGuard, CapabilityGuard)
  @RequireCapability("agro.shell.read")
  @Get("status")
  getStatus(@CurrentAgroUser() currentUser: AgroRequestUser) {
    return this.agroService.getStatus(currentUser);
  }

  @UseGuards(AgroAuthGuard, CapabilityGuard)
  @RequireCapability("agro.discovery.read")
  @Get("discovery/latest")
  getLatestDiscoveryResponse(@CurrentAgroUser() currentUser: AgroRequestUser) {
    return this.agroService.getLatestDiscoveryResponse(currentUser);
  }

  @UseGuards(AgroAuthGuard, CapabilityGuard)
  @RequireCapability("agro.discovery.write")
  @Post("discovery")
  saveDiscoveryResponse(
    @CurrentAgroUser() currentUser: AgroRequestUser,
    @Body() dto: SaveAgroDiscoveryResponseDto
  ) {
    return this.agroService.saveDiscoveryResponse(currentUser, dto);
  }
}
