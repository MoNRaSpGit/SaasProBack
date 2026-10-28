import { Controller, Get, Post, Req, Res } from "@nestjs/common";
import { Request, Response } from "express";
import { WhatsappService } from "./whatsapp.service";

@Controller("whatsapp")
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Get("webhook")
  verify(@Req() req: Request, @Res() res: Response) {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === this.whatsappService.verifyToken) {
      res.status(200).send(challenge);
      return;
    }
    res.sendStatus(403);
  }

  @Post("webhook")
  async receive(@Req() req: Request, @Res() res: Response) {
    // Responder rapido siempre (Meta reintenta si no responde 200 a tiempo).
    res.sendStatus(200);

    const body = req.body;
    const value = body?.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];
    if (!message) return;

    const contactName = value?.contacts?.[0]?.profile?.name;

    try {
      await this.whatsappService.handleIncomingMessage(message, contactName);
    } catch (err) {
      // No relanzar: ya respondimos 200 a Meta, esto es solo para el log.
      console.error("Error procesando mensaje de WhatsApp:", err);
    }
  }
}
