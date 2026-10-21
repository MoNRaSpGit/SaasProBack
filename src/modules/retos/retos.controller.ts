import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query } from "@nestjs/common";
import { CreateRetoChallengeDto } from "./dto/create-reto-challenge.dto";
import { ResolveRetoChallengeDto } from "./dto/resolve-reto-challenge.dto";
import { RetosService } from "./retos.service";

@Controller("retos")
export class RetosController {
  constructor(private readonly retosService: RetosService) {}

  @Get("challenges")
  listChallenges() {
    return this.retosService.listChallenges();
  }

  @Post("challenges")
  createChallenge(@Body() dto: CreateRetoChallengeDto) {
    return this.retosService.createChallenge(dto);
  }

  @Delete("challenges/:id")
  deleteChallenge(@Param("id", ParseIntPipe) id: number) {
    return this.retosService.deleteChallenge(id);
  }

  @Post("challenges/:id/resolve")
  resolveChallenge(@Param("id", ParseIntPipe) id: number, @Body() dto: ResolveRetoChallengeDto) {
    return this.retosService.resolveChallenge(id, dto);
  }

  @Get("state")
  getState() {
    return this.retosService.getState();
  }

  @Get("history")
  listHistory(@Query("limit") limit?: string) {
    return this.retosService.listHistory(limit ? Number(limit) : undefined);
  }
}
