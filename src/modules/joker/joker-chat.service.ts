import { Injectable } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CreateJokerChatMessageDto } from "./dto/create-joker-chat-message.dto";
import { toIsoString } from "./joker.dateUtils";
import { JokerChatMessage } from "./joker.types";

type JokerChatMessageRow = RowDataPacket & {
  id: number;
  sender_role: "administrador" | "usuario";
  message: string;
  created_at: string | Date;
};

// Chat interno basico Administrador <-> Usuario: un solo canal
// compartido (no hay cuentas individuales, el login es por rol, ver
// JokerRoleLoginScreen), asi que no hace falta destinatario ni sala --
// todos los mensajes son de un lado o del otro, y los dos roles ven la
// misma lista completa.
@Injectable()
export class JokerChatService {
  constructor(private readonly databaseService: DatabaseService) {}

  async sendMessage(dto: CreateJokerChatMessageDto): Promise<{ item: JokerChatMessage }> {
    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_joker_chat_messages (sender_role, message) VALUES (?, ?)`,
      [dto.senderRole, dto.message.trim()]
    );

    const rows = await this.databaseService.query<JokerChatMessageRow[]>(
      `SELECT id, sender_role, message, created_at FROM saas_joker_chat_messages WHERE id = ? LIMIT 1`,
      [result.insertId]
    );

    return { item: this.mapMessage(rows[0]) };
  }

  // Ultimos 200 mensajes -- de sobra para un chat interno de ida y vuelta
  // entre dos roles, sin necesidad de paginar.
  async listMessages(): Promise<{ items: JokerChatMessage[] }> {
    const rows = await this.databaseService.query<JokerChatMessageRow[]>(
      `SELECT id, sender_role, message, created_at FROM saas_joker_chat_messages ORDER BY id ASC LIMIT 200`
    );

    return { items: rows.map((row) => this.mapMessage(row)) };
  }

  private mapMessage(row: JokerChatMessageRow): JokerChatMessage {
    return {
      id: Number(row.id),
      senderRole: row.sender_role,
      message: row.message,
      createdAt: toIsoString(row.created_at)
    };
  }
}
