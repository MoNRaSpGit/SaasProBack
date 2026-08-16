import { Body, Controller, Delete, Get, Param, Patch, ParseIntPipe, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { CarnetAdminGuard } from "./carnet-admin.guard";
import { CarnetService } from "./carnet.service";
import { AddCarnetEventPlayerBuyerDto } from "./dto/add-carnet-event-player-buyer.dto";
import { CarnetAdminLoginDto } from "./dto/carnet-admin-login.dto";
import { CreateCarnetEventDto } from "./dto/create-carnet-event.dto";
import { RecordCarnetVisitDto } from "./dto/record-carnet-visit.dto";
import { SetCarnetEventPlayerBuyerDeliveredDto } from "./dto/set-carnet-event-player-buyer-delivered.dto";
import { CreateCarnetPlayerDto } from "./dto/create-carnet-player.dto";
import { UpdateCarnetEventDto } from "./dto/update-carnet-event.dto";
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

  @Post("admin/login")
  loginAdmin(@Body() dto: CarnetAdminLoginDto) {
    return this.carnetService.loginAdmin(dto.pin);
  }

  @Get("players")
  listPlayers() {
    return this.carnetService.listPlayers();
  }

  @Post("visits")
  recordVisit(@Body() dto: RecordCarnetVisitDto, @Req() request: Request) {
    const forwardedFor = request.headers["x-forwarded-for"];
    const ip = typeof forwardedFor === "string" ? forwardedFor.split(",")[0].trim() : request.ip || null;
    const userAgentHeader = request.headers["user-agent"];
    const userAgent = typeof userAgentHeader === "string" ? userAgentHeader : null;
    return this.carnetService.recordVisit(dto, ip, userAgent);
  }

  @Get("visits")
  @UseGuards(CarnetAdminGuard)
  listVisitSummary() {
    return this.carnetService.listVisitSummary();
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
  @UseGuards(CarnetAdminGuard)
  createEvent(@Body() dto: CreateCarnetEventDto) {
    return this.carnetService.createEvent(dto);
  }

  @Patch("events/:id")
  @UseGuards(CarnetAdminGuard)
  setEventClosed(@Param("id", ParseIntPipe) eventId: number, @Body() dto: UpdateCarnetEventDto) {
    return this.carnetService.setEventClosed(eventId, dto.isClosed);
  }

  @Post("players")
  @UseGuards(CarnetAdminGuard)
  createPlayer(@Body() dto: CreateCarnetPlayerDto) {
    return this.carnetService.createPlayer(dto);
  }

  @Post("events/:id/players")
  @UseGuards(CarnetAdminGuard)
  upsertEventPlayer(@Param("id", ParseIntPipe) eventId: number, @Body() dto: UpsertCarnetEventPlayerDto) {
    return this.carnetService.upsertEventPlayer(eventId, dto);
  }

  @Patch("events/:eventId/players/:playerId")
  @UseGuards(CarnetAdminGuard)
  updateEventPlayer(
    @Param("eventId", ParseIntPipe) eventId: number,
    @Param("playerId", ParseIntPipe) playerId: number,
    @Body() dto: UpdateCarnetEventPlayerDto
  ) {
    return this.carnetService.updateEventPlayer(eventId, playerId, dto);
  }

  @Post("events/:eventId/players/:playerId/buyers")
  @UseGuards(CarnetAdminGuard)
  addEventPlayerBuyer(
    @Param("eventId", ParseIntPipe) eventId: number,
    @Param("playerId", ParseIntPipe) playerId: number,
    @Body() dto: AddCarnetEventPlayerBuyerDto
  ) {
    return this.carnetService.addEventPlayerBuyer(eventId, playerId, dto);
  }

  // Sin guard: lo usa cualquier usuario (no solo admin) para marcar
  // entregas de porciones desde UsuarioApp.
  @Patch("events/:eventId/players/:playerId/buyers/:buyerId/delivered")
  setEventPlayerBuyerDelivered(
    @Param("eventId", ParseIntPipe) eventId: number,
    @Param("playerId", ParseIntPipe) playerId: number,
    @Param("buyerId", ParseIntPipe) buyerId: number,
    @Body() dto: SetCarnetEventPlayerBuyerDeliveredDto
  ) {
    return this.carnetService.setEventPlayerBuyerDelivered(eventId, playerId, buyerId, dto);
  }

  @Delete("events/:eventId/players/:playerId/buyers/:buyerId")
  @UseGuards(CarnetAdminGuard)
  removeEventPlayerBuyer(
    @Param("eventId", ParseIntPipe) eventId: number,
    @Param("playerId", ParseIntPipe) playerId: number,
    @Param("buyerId", ParseIntPipe) buyerId: number
  ) {
    return this.carnetService.removeEventPlayerBuyer(eventId, playerId, buyerId);
  }

  @Patch("players/:id")
  @UseGuards(CarnetAdminGuard)
  updatePlayer(@Param("id", ParseIntPipe) playerId: number, @Body() dto: UpdateCarnetPlayerDto) {
    return this.carnetService.updatePlayer(playerId, dto);
  }

  @Delete("players/:id")
  @UseGuards(CarnetAdminGuard)
  deletePlayer(@Param("id", ParseIntPipe) playerId: number) {
    return this.carnetService.deletePlayer(playerId);
  }
}
