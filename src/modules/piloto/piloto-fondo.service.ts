import { Injectable } from "@nestjs/common";
import { RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { PilotoFondoItemDto } from "./dto/set-piloto-fondo-cart.dto";

type FondoRow = RowDataPacket & { items: string | PilotoFondoItemDto[]; sent_at: string | null; updated_at: string | null };

export type PilotoFondoCart = { items: PilotoFondoItemDto[]; sentAt: string | null; updatedAt: string | null };

function parseItems(raw: string | PilotoFondoItemDto[] | null | undefined): PilotoFondoItemDto[] {
  if (!raw) return [];
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

// Venta del "fondo" (30/10/2026, pedido explicito): la tablet del fondo
// guarda aca lo que va escaneando y el mostrador la lee cada pocos
// segundos. "Tomar" devuelve los productos y vacia la fila en la misma
// transaccion, para que no se puedan tomar dos veces ni perder un producto
// que entro justo en el medio. Fechas con DATE_FORMAT (nunca la columna
// DATETIME cruda), mismo criterio que el resto del backend por la zona horaria.
@Injectable()
export class PilotoFondoService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getCart(): Promise<PilotoFondoCart> {
    const rows = await this.databaseService.query<FondoRow[]>(
      "SELECT items, DATE_FORMAT(sent_at, '%Y-%m-%dT%H:%i:%s') AS sent_at, DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%s') AS updated_at FROM saas_piloto_fondo_cart WHERE id = 1"
    );
    if (!rows.length) return { items: [], sentAt: null, updatedAt: null };
    return { items: parseItems(rows[0].items), sentAt: rows[0].sent_at, updatedAt: rows[0].updated_at };
  }

  // sent = true: la tablet apreto "Enviar al mostrador". Si la lista queda
  // vacia se borra la marca de enviado.
  async setCart(items: PilotoFondoItemDto[], sent: boolean): Promise<PilotoFondoCart> {
    const sentExpr = sent ? "NOW()" : "IF(JSON_LENGTH(VALUES(items)) = 0, NULL, sent_at)";
    await this.databaseService.execute(
      `INSERT INTO saas_piloto_fondo_cart (id, items, sent_at, updated_at) VALUES (1, ?, ${sent ? "NOW()" : "NULL"}, NOW())
       ON DUPLICATE KEY UPDATE items = VALUES(items), sent_at = ${sentExpr}, updated_at = NOW()`,
      [JSON.stringify(items)]
    );
    return this.getCart();
  }

  async takeCart(): Promise<PilotoFondoCart> {
    return this.databaseService.withTransaction(async (connection) => {
      const [rows] = await connection.query<FondoRow[]>("SELECT items FROM saas_piloto_fondo_cart WHERE id = 1 FOR UPDATE");
      const items = rows.length ? parseItems(rows[0].items) : [];
      await connection.query("UPDATE saas_piloto_fondo_cart SET items = JSON_ARRAY(), sent_at = NULL, updated_at = NOW() WHERE id = 1");
      return { items, sentAt: null, updatedAt: null };
    });
  }
}
