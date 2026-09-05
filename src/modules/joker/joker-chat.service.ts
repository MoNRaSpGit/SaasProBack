import { Injectable, NotFoundException } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CreateJokerChatMessageDto } from "./dto/create-joker-chat-message.dto";
import { UpdateJokerChatMessageDto } from "./dto/update-joker-chat-message.dto";
import { toIsoString } from "./joker.dateUtils";
import { JokerChatMessage } from "./joker.types";

type JokerChatMessageRow = RowDataPacket & {
  id: number;
  sender_role: "administrador" | "usuario";
  message: string;
  created_at: string | Date;
  edited_at: string | Date | null;
  deleted_at: string | Date | null;
};

const MESSAGE_COLUMNS = "id, sender_role, message, created_at, edited_at, deleted_at";

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

    return { item: await this.getMessageOrThrow(result.insertId) };
  }

  // Ultimos 200 mensajes -- de sobra para un chat interno de ida y vuelta
  // entre dos roles, sin necesidad de paginar. Los borrados (deleted_at)
  // se siguen mandando (el frontend los muestra como "Mensaje eliminado",
  // igual que WhatsApp) en vez de desaparecer del todo de la conversacion.
  async listMessages(): Promise<{ items: JokerChatMessage[] }> {
    const rows = await this.databaseService.query<JokerChatMessageRow[]>(
      `SELECT ${MESSAGE_COLUMNS} FROM saas_joker_chat_messages ORDER BY id ASC LIMIT 200`
    );

    return { items: rows.map((row) => this.mapMessage(row)) };
  }

  // Editar, como WhatsApp: cambia el texto y marca edited_at -- no se
  // puede editar un mensaje ya borrado.
  async updateMessage(messageId: number, dto: UpdateJokerChatMessageDto): Promise<{ item: JokerChatMessage }> {
    const result = await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_joker_chat_messages SET message = ?, edited_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL`,
      [dto.message.trim(), messageId]
    );
    if (!result.affectedRows) {
      throw new NotFoundException("Mensaje no encontrado");
    }

    return { item: await this.getMessageOrThrow(messageId) };
  }

  // Borrado logico, como WhatsApp: el mensaje sigue en la tabla (por si
  // hace falta auditar algo despues) pero deleted_at queda marcado, y el
  // frontend lo reemplaza por un texto generico en vez del contenido real.
  async deleteMessage(messageId: number): Promise<{ item: JokerChatMessage }> {
    const result = await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_joker_chat_messages SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL`,
      [messageId]
    );
    if (!result.affectedRows) {
      throw new NotFoundException("Mensaje no encontrado");
    }

    return { item: await this.getMessageOrThrow(messageId) };
  }

  private async getMessageOrThrow(messageId: number): Promise<JokerChatMessage> {
    const rows = await this.databaseService.query<JokerChatMessageRow[]>(
      `SELECT ${MESSAGE_COLUMNS} FROM saas_joker_chat_messages WHERE id = ? LIMIT 1`,
      [messageId]
    );
    if (!rows[0]) {
      throw new NotFoundException("Mensaje no encontrado");
    }
    return this.mapMessage(rows[0]);
  }

  private mapMessage(row: JokerChatMessageRow): JokerChatMessage {
    return {
      id: Number(row.id),
      senderRole: row.sender_role,
      message: row.message,
      createdAt: toIsoString(row.created_at),
      editedAt: row.edited_at ? toIsoString(row.edited_at) : null,
      deletedAt: row.deleted_at ? toIsoString(row.deleted_at) : null
    };
  }
}
