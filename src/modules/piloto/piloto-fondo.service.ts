import { Injectable } from "@nestjs/common";
import { RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { PilotoFondoItemDto } from "./dto/set-piloto-fondo-cart.dto";

type FondoRow = RowDataPacket & {
  id: number;
  items: string | PilotoFondoItemDto[];
  sent_at: string | null;
  claimed: number;
  delivered_items: string | PilotoFondoItemDto[] | null;
  closing: number;
};

// Un pedido enviado desde la tablet. number = Pedido 1, 2, 3... en orden de
// llegada (vuelve a 1 cuando el mostrador se lleva todos).
export type PilotoFondoOrder = { id: number; number: number; items: PilotoFondoItemDto[]; sentAt: string | null };

// orders: pedidos enviados, en orden, esperando en el mostrador.
// draftItems: lo que la tablet esta pasando ahora (todavia sin enviar). Un
// codigo escaneado sin catalogar llega aca como una linea mas, "Producto
// no encontrado" (la tablet la arma, ver PilotoTabletScreen.tsx) -- no es
// un caso especial para este servicio.
// draftClaimed: ya no se usa (siempre false); se deja para las apps viejas.
export type PilotoFondoState = {
  orders: PilotoFondoOrder[];
  draftItems: PilotoFondoItemDto[];
  draftClaimed: boolean;
};

function parseItems(raw: string | PilotoFondoItemDto[] | null | undefined): PilotoFondoItemDto[] {
  if (!raw) return [];
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

const DRAFT_ID = 1;

// Venta del "fondo" (30/10/2026): la tablet del fondo guarda en la fila 1 lo
// que va escaneando (el "borrador") y, al apretar "Enviar", ese borrador pasa
// a ser un Pedido numerado que espera en el mostrador.
//
// "Tomar y seguir recibiendo" (03/11/2026) se SACO el 06/11/2026, pedido
// explicito: "que no se pueda robar el pedido... solo cuando le de enviar,
// ahi se queda con el pedido". El mostrador ya no reclama el borrador: solo
// ve y toma Pedidos enviados. Las columnas claimed/delivered_items/closing
// quedan en la tabla pero ya no se usan (siempre en reposo).
@Injectable()
export class PilotoFondoService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getState(): Promise<PilotoFondoState> {
    const rows = await this.databaseService.query<FondoRow[]>(
      `SELECT id, items, DATE_FORMAT(sent_at, '%Y-%m-%dT%H:%i:%s') AS sent_at, claimed
       FROM saas_piloto_fondo_cart ORDER BY id`
    );
    const draft = rows.find((r) => r.id === DRAFT_ID);
    const orders = rows
      .filter((r) => r.id > DRAFT_ID)
      .map((r) => ({ id: r.id, number: r.id - DRAFT_ID, items: parseItems(r.items), sentAt: r.sent_at }))
      .filter((o) => o.items.length > 0);
    return {
      orders,
      draftItems: parseItems(draft?.items),
      draftClaimed: false
    };
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

  // Compatibilidad (06/11/2026): versiones viejas de la app que todavia
  // esten abiertas en el local llaman a esto para "robar" el borrador. Ya no
  // se puede: no reclama nada ni entrega nada. Se puede borrar cuando no
  // quede ninguna app vieja abierta.
  async syncDraft(_claim: boolean): Promise<{ items: PilotoFondoItemDto[]; closed: boolean }> {
    return { items: [], closed: false };
  }

  // "Enviar al mostrador": el borrador pasa a ser un pedido nuevo al final de
  // la fila y la tablet queda vacia.
  async sendOrder(items: PilotoFondoItemDto[]): Promise<PilotoFondoState> {
    await this.databaseService.withTransaction(async (connection) => {
      await connection.query(
        `INSERT INTO saas_piloto_fondo_cart (id, items, sent_at, updated_at) VALUES (1, JSON_ARRAY(), NULL, NOW())
         ON DUPLICATE KEY UPDATE updated_at = updated_at`
      );
      await connection.query("SELECT id FROM saas_piloto_fondo_cart WHERE id = 1 FOR UPDATE");

      if (!items.length) return;
      await connection.query("DELETE FROM saas_piloto_fondo_cart WHERE id > 1 AND JSON_LENGTH(items) = 0");
      const [maxRows] = await connection.query<FondoRow[]>("SELECT COALESCE(MAX(id), 1) AS id FROM saas_piloto_fondo_cart WHERE id > 1");
      const nextId = Number(maxRows[0].id) + 1;
      await connection.query("INSERT INTO saas_piloto_fondo_cart (id, items, sent_at, updated_at) VALUES (?, ?, NOW(), NOW())", [
        nextId,
        JSON.stringify(items)
      ]);
      await connection.query(
        "UPDATE saas_piloto_fondo_cart SET items = JSON_ARRAY(), sent_at = NULL, claimed = 0, delivered_items = NULL, closing = 0, updated_at = NOW() WHERE id = 1"
      );
    });
    return this.getState();
  }

  // orderId: el pedido que se toma (siempre de una sola vez, son
  // inmutables desde que se envian). Sin orderId: el borrador -- se
  // mantiene por compatibilidad, pero el flujo nuevo usa syncDraft.
  async take(orderId?: number): Promise<{ items: PilotoFondoItemDto[] }> {
    return this.databaseService.withTransaction(async (connection) => {
      const id = orderId && orderId > DRAFT_ID ? orderId : DRAFT_ID;
      const [rows] = await connection.query<FondoRow[]>("SELECT items FROM saas_piloto_fondo_cart WHERE id = ? FOR UPDATE", [id]);
      const items = rows.length ? parseItems(rows[0].items) : [];
      if (id === DRAFT_ID) {
        await connection.query(
          `UPDATE saas_piloto_fondo_cart
           SET items = JSON_ARRAY(), claimed = 0, delivered_items = NULL, closing = 0, sent_at = NULL, updated_at = NOW()
           WHERE id = 1`
        );
      } else {
        await connection.query("DELETE FROM saas_piloto_fondo_cart WHERE id = ?", [id]);
      }
      return { items };
    });
  }
}
