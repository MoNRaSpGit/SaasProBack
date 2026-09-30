import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put } from "@nestjs/common";
import { SaveGymWorkspaceDto } from "./dto/save-gym-workspace.dto";
import { GymService } from "./gym.service";

@Controller("gym")
export class GymController {
  constructor(private readonly gymService: GymService) {}

  @Get("workspace")
  getWorkspace() {
    return this.gymService.getWorkspace();
  }

  @Put("workspace")
  saveWorkspace(@Body() dto: SaveGymWorkspaceDto) {
    return this.gymService.saveWorkspace(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post("auth/login")
  login() {
    return this.gymService.recordLogin();
  }
}
