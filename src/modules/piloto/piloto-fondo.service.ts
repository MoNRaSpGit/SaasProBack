import { Injectable } from "@nestjs/common";
import { RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { PilotoFondoItemDto } from "./dto/set-piloto-fondo-cart.dto";

type FondoRow = RowDataPacket & { id: number; items: string | PilotoFondoItemDto[]; sent_at: string | null; updated_at: string | null };

// Un pedido enviado desde la tablet. number = Pedido 1, 2, 3... en orden de
// llegada (vuelve a 1 cuando el mostrador se lleva todos).
export type PilotoFondoOrder = { id: number; number: number; items: PilotoFondoItemDto[]; sentAt: string | null };

// orders: pedidos enviados, en orden, esperando en el mostrador.
// draftItems: lo que la tablet esta pasando ahora (todavia sin enviar).
export type PilotoFondoState = { orders: PilotoFondoOrder[]; draftItems: PilotoFondoItemDto[] };

function parseItems(raw: string | PilotoFondoItemDto[] | null | undefined): PilotoFondoItemDto[] {
  if (!raw) return [];
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

const DRAFT_ID = 1;

// Venta del "fondo" (30/10/2026, pedido explicito): la tablet del fondo
// guarda en la fila 1 lo que va escaneando (el "borrador") y el mostrador lo
// lee cada pocos segundos. Cada "Enviar al mostrador" es un PEDIDO aparte
// (pedido explicito: "no sumes todos los pedidos... pedido 1, pedido 2,
// pedido 3"): una fila nueva (id 2, 3, 4...) y la tablet queda vacia para el
// proximo cliente. El mostrador toma un pedido por vez; si no se envio nada,
// puede llevarse el borrador igual. Tomar borra/vacia en la misma
// transaccion, para que no se pueda tomar dos veces. Fechas con DATE_FORMAT
// (nunca la columna DATETIME cruda), mismo criterio que el resto del backend.
@Injectable()
export class PilotoFondoService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getState(): Promise<PilotoFondoState> {
    const rows = await this.databaseService.query<FondoRow[]>(
      "SELECT id, items, DATE_FORMAT(sent_at, '%Y-%m-%dT%H:%i:%s') AS sent_at FROM saas_piloto_fondo_cart ORDER BY id"
    );
    const draft = rows.find((r) => r.id === DRAFT_ID);
    const orders = rows
      .filter((r) => r.id > DRAFT_ID)
      .map((r) => ({ id: r.id, number: r.id - DRAFT_ID, items: parseItems(r.items), sentAt: r.sent_at }))
      .filter((o) => o.items.length > 0);
    return { orders, draftItems: parseItems(draft?.items) };
  }

  // La tablet guarda lo que va pasando (borrador).
  async saveDraft(items: PilotoFondoItemDto[]): Promise<PilotoFondoState> {
    await this.databaseService.execute(
      `INSERT INTO saas_piloto_fondo_cart (id, items, sent_at, updated_at) VALUES (1, ?, NULL, NOW())
       ON DUPLICATE KEY UPDATE items = VALUES(items), sent_at = NULL, updated_at = NOW()`,
      [JSON.stringify(items)]
    );
    return this.getState();
  }

  // "Enviar al mostrador": un pedido nuevo al final de la fila y el
  // borrador vacio. La fila 1 se bloquea para que dos envios a la vez no
  // agarren el mismo numero.
  async sendOrder(items: PilotoFondoItemDto[]): Promise<PilotoFondoState> {
    if (items.length) {
      await this.databaseService.withTransaction(async (connection) => {
        await connection.query(
          `INSERT INTO saas_piloto_fondo_cart (id, items, sent_at, updated_at) VALUES (1, JSON_ARRAY(), NULL, NOW())
           ON DUPLICATE KEY UPDATE updated_at = updated_at`
        );
        await connection.query("SELECT id FROM saas_piloto_fondo_cart WHERE id = 1 FOR UPDATE");
        await connection.query("DELETE FROM saas_piloto_fondo_cart WHERE id > 1 AND JSON_LENGTH(items) = 0");
        const [rows] = await connection.query<FondoRow[]>("SELECT COALESCE(MAX(id), 1) AS id FROM saas_piloto_fondo_cart WHERE id > 1");
        const nextId = Number(rows[0].id) + 1;
        await connection.query("INSERT INTO saas_piloto_fondo_cart (id, items, sent_at, updated_at) VALUES (?, ?, NOW(), NOW())", [
          nextId,
          JSON.stringify(items)
        ]);
        await connection.query("UPDATE saas_piloto_fondo_cart SET items = JSON_ARRAY(), sent_at = NULL, updated_at = NOW() WHERE id = 1");
      });
    }
    return this.getState();
  }

  // orderId: el pedido que se toma. Sin orderId: el borrador (lo que la
  // tablet esta pasando sin haber enviado).
  async take(orderId?: number): Promise<{ items: PilotoFondoItemDto[] }> {
    return this.databaseService.withTransaction(async (connection) => {
      const id = orderId && orderId > DRAFT_ID ? orderId : DRAFT_ID;
      const [rows] = await connection.query<FondoRow[]>("SELECT items FROM saas_piloto_fondo_cart WHERE id = ? FOR UPDATE", [id]);
      const items = rows.length ? parseItems(rows[0].items) : [];
      if (id === DRAFT_ID) {
        await connection.query("UPDATE saas_piloto_fondo_cart SET items = JSON_ARRAY(), sent_at = NULL, updated_at = NOW() WHERE id = 1");
      } else {
        await connection.query("DELETE FROM saas_piloto_fondo_cart WHERE id = ?", [id]);
      }
      return { items };
    });
  }
}
