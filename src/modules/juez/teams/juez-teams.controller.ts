import { Body, Controller, Get, Post } from "@nestjs/common";
import { CreateJuezTeamDto } from "./dto/create-juez-team.dto";
import { JuezTeamsService } from "./juez-teams.service";

@Controller("juez-teams")
export class JuezTeamsController {
  constructor(private readonly juezTeamsService: JuezTeamsService) {}

  @Get()
  listTeams() {
    return this.juezTeamsService.listTeams();
  }

  @Post()
  createTeam(@Body() dto: CreateJuezTeamDto) {
    return this.juezTeamsService.createTeam(dto);
  }
}
