import { Controller, Get } from "@nestjs/common";
import { ScrumService } from "./scrum.service";

@Controller("scrum")
export class ScrumController {
  constructor(private readonly scrumService: ScrumService) {}

  @Get("sample")
  getSample() {
    return this.scrumService.getSample();
  }
}
