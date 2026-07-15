import { Body, Controller, Delete, Get, Param, Patch, ParseIntPipe, Post } from "@nestjs/common";
import { CarnetService } from "./carnet.service";
import { CreateCarnetEventDto } from "./dto/create-carnet-event.dto";
import { CreateCarnetPlayerDto } from "./dto/create-carnet-player.dto";
import { UpdateCarnetEventPlayerDto } from "./dto/update-carnet-event-player.dto";
import { UpdateCarnetPlayerDto } from "./dto/update-carnet-player.dto";
import { UpsertCarnetEventPlayerDto } from "./dto/upsert-carnet-event-player.dto";

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

  @Get("events")
  listEvents() {
    return this.carnetService.listEvents();
  }

  @Get("events/:id")
  getEvent(@Param("id", ParseIntPipe) eventId: number) {
    return this.carnetService.getEvent(eventId);
  }

  @Post("events")
  createEvent(@Body() dto: CreateCarnetEventDto) {
    return this.carnetService.createEvent(dto);
  }

  @Post("players")
  createPlayer(@Body() dto: CreateCarnetPlayerDto) {
    return this.carnetService.createPlayer(dto);
  }

  @Post("events/:id/players")
  upsertEventPlayer(@Param("id", ParseIntPipe) eventId: number, @Body() dto: UpsertCarnetEventPlayerDto) {
    return this.carnetService.upsertEventPlayer(eventId, dto);
  }

  @Patch("events/:eventId/players/:playerId")
  updateEventPlayer(
    @Param("eventId", ParseIntPipe) eventId: number,
    @Param("playerId", ParseIntPipe) playerId: number,
    @Body() dto: UpdateCarnetEventPlayerDto
  ) {
    return this.carnetService.updateEventPlayer(eventId, playerId, dto);
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
