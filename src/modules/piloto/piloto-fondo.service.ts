import { Injectable } from "@nestjs/common";
import { RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { PilotoFondoItemDto } from "./dto/set-piloto-fondo-cart.dto";

type FondoRow = RowDataPacket & { id: number; items: string | PilotoFondoItemDto[]; sent_at: string | null; updated_at: string | null };

// items/sentAt: lo que ve el mostrador (lo ENVIADO si hay, si no lo que la
// tablet esta pasando). draftItems: lo que la tablet esta pasando ahora.
export type PilotoFondoCart = { items: PilotoFondoItemDto[]; sentAt: string | null; updatedAt: string | null; draftItems: PilotoFondoItemDto[] };

function parseItems(raw: string | PilotoFondoItemDto[] | null | undefined): PilotoFondoItemDto[] {
  if (!raw) return [];
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

// Suma cantidades del mismo producto (si se envian dos tandas antes de que
// el mostrador las tome).
function mergeItems(base: PilotoFondoItemDto[], extra: PilotoFondoItemDto[]): PilotoFondoItemDto[] {
  const merged = base.map((item) => ({ ...item }));
  for (const item of extra) {
    const existing = merged.find((x) => x.productId === item.productId);
    if (existing) existing.quantity += item.quantity;
    else merged.push({ ...item });
  }
  return merged;
}

const DRAFT_ID = 1;
const SENT_ID = 2;

// Venta del "fondo" (30/10/2026, pedido explicito): la tablet del fondo
// guarda aca lo que va escaneando (fila 1, "borrador") y el mostrador la lee
// cada pocos segundos. Al apretar "Enviar" (pedido explicito: "si envio,
// que se borre... y empieza de vuelta") lo del borrador pasa a la fila 2
// ("enviada") y la tablet queda vacia para el proximo cliente. "Tomar"
// devuelve lo enviado (o, si no se envio nada, el borrador) y lo vacia en la
// misma transaccion, para que no se pueda tomar dos veces. Fechas con
// DATE_FORMAT (nunca la columna DATETIME cruda), mismo criterio que el resto
// del backend por la zona horaria.
@Injectable()
export class PilotoFondoService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getCart(): Promise<PilotoFondoCart> {
    const rows = await this.databaseService.query<FondoRow[]>(
      "SELECT id, items, DATE_FORMAT(sent_at, '%Y-%m-%dT%H:%i:%s') AS sent_at, DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%s') AS updated_at FROM saas_piloto_fondo_cart WHERE id IN (1, 2)"
    );
    const draft = rows.find((r) => r.id === DRAFT_ID);
    const sent = rows.find((r) => r.id === SENT_ID);
    const draftItems = parseItems(draft?.items);
    const sentItems = parseItems(sent?.items);
    if (sentItems.length) {
      return { items: sentItems, sentAt: sent?.sent_at ?? null, updatedAt: sent?.updated_at ?? null, draftItems };
    }
    return { items: draftItems, sentAt: null, updatedAt: draft?.updated_at ?? null, draftItems };
  }

  // sent = false: la tablet guarda lo que va pasando (borrador).
  // sent = true: "Enviar al mostrador": los items se suman a lo enviado y el
  // borrador queda vacio.
  async setCart(items: PilotoFondoItemDto[], sent: boolean): Promise<PilotoFondoCart> {
    if (!sent) {
      await this.databaseService.execute(
        `INSERT INTO saas_piloto_fondo_cart (id, items, sent_at, updated_at) VALUES (1, ?, NULL, NOW())
         ON DUPLICATE KEY UPDATE items = VALUES(items), sent_at = NULL, updated_at = NOW()`,
        [JSON.stringify(items)]
      );
      return this.getCart();
    }

    await this.databaseService.withTransaction(async (connection) => {
      const [rows] = await connection.query<FondoRow[]>("SELECT items FROM saas_piloto_fondo_cart WHERE id = 2 FOR UPDATE");
      const merged = mergeItems(rows.length ? parseItems(rows[0].items) : [], items);
      await connection.query(
        `INSERT INTO saas_piloto_fondo_cart (id, items, sent_at, updated_at) VALUES (2, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE items = VALUES(items), sent_at = NOW(), updated_at = NOW()`,
        [JSON.stringify(merged)]
      );
      await connection.query(
        `INSERT INTO saas_piloto_fondo_cart (id, items, sent_at, updated_at) VALUES (1, JSON_ARRAY(), NULL, NOW())
         ON DUPLICATE KEY UPDATE items = JSON_ARRAY(), sent_at = NULL, updated_at = NOW()`
      );
    });
    return this.getCart();
  }

  async takeCart(): Promise<PilotoFondoCart> {
    return this.databaseService.withTransaction(async (connection) => {
      const [rows] = await connection.query<FondoRow[]>("SELECT id, items FROM saas_piloto_fondo_cart WHERE id IN (1, 2) FOR UPDATE");
      const sentItems = parseItems(rows.find((r) => r.id === SENT_ID)?.items);
      const takeId = sentItems.length ? SENT_ID : DRAFT_ID;
      const items = sentItems.length ? sentItems : parseItems(rows.find((r) => r.id === DRAFT_ID)?.items);
      await connection.query("UPDATE saas_piloto_fondo_cart SET items = JSON_ARRAY(), sent_at = NULL, updated_at = NOW() WHERE id = ?", [takeId]);
      return { items, sentAt: null, updatedAt: null, draftItems: [] };
    });
  }
}
