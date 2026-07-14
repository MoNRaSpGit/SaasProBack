import { Body, Controller, Delete, Get, Param, Patch, ParseIntPipe, Post } from "@nestjs/common";
import { CarnetService } from "./carnet.service";
import { CreateCarnetPlayerDto } from "./dto/create-carnet-player.dto";
import { UpdateCarnetPlayerDto } from "./dto/update-carnet-player.dto";

@Controller("carnet")
export class CarnetController {
  constructor(private readonly carnetService: CarnetService) {}

  @Get("status")
  getStatus() {
    return this.carnetService.getStatus();
  }

  @Get("players")
  listPlayers() {
    return this.carnetService.listPlayers();
  }

  @Post("players")
  createPlayer(@Body() dto: CreateCarnetPlayerDto) {
    return this.carnetService.createPlayer(dto);
  }

  @Patch("players/:id")
  updatePlayer(@Param("id", ParseIntPipe) playerId: number, @Body() dto: UpdateCarnetPlayerDto) {
    return this.carnetService.updatePlayer(playerId, dto);
  }

  @Delete("players/:id")
  deletePlayer(@Param("id", ParseIntPipe) playerId: number) {
    return this.carnetService.deletePlayer(playerId);
  }
}
