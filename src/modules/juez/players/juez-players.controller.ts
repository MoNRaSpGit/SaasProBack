import { Body, Controller, Get, Param, Patch, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import { CreateJuezPlayerDto } from "./dto/create-juez-player.dto";
import { UpdateJuezPlayerDto } from "./dto/update-juez-player.dto";
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

  @Patch(":id")
  updatePlayer(@Param("id") id: string, @Body() dto: UpdateJuezPlayerDto) {
    return this.juezPlayersService.updatePlayer(Number(id), dto);
  }

  // Sirve la foto en binario por separado del listado, para que listar
  // jugadores no transfiera el base64 completo de cada foto.
  @Get(":id/photo")
  async getPlayerPhoto(@Param("id") id: string, @Res() res: Response) {
    const photo = await this.juezPlayersService.getPlayerPhoto(Number(id));

    res.set({
      "Content-Type": photo.mimeType,
      "Cache-Control": "public, max-age=31536000, immutable"
    });
    res.send(photo.buffer);
  }
}
