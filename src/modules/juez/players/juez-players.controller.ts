import { Body, Controller, Get, Post } from "@nestjs/common";
import { CreateJuezPlayerDto } from "./dto/create-juez-player.dto";
import { JuezPlayersService } from "./juez-players.service";

@Controller("juez-players")
export class JuezPlayersController {
  constructor(private readonly juezPlayersService: JuezPlayersService) {}

  @Get()
  listPlayers() {
    return this.juezPlayersService.listPlayers();
  }

  @Post()
  createPlayer(@Body() dto: CreateJuezPlayerDto) {
    return this.juezPlayersService.createPlayer(dto);
  }
}
