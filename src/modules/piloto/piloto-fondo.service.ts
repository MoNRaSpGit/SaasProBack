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
  pending_unknown_barcode: string | null;
};

// Un pedido enviado desde la tablet. number = Pedido 1, 2, 3... en orden de
// llegada (vuelve a 1 cuando el mostrador se lleva todos).
export type PilotoFondoOrder = { id: number; number: number; items: PilotoFondoItemDto[]; sentAt: string | null };

// orders: pedidos enviados, en orden, esperando en el mostrador.
// draftItems: lo que la tablet esta pasando ahora (todavia sin enviar).
// draftClaimed: alguna caja ya empezo a recibir en vivo lo que se escanea.
// pendingUnknownBarcode: codigo escaneado en la tablet que no existe en
// el catalogo, esperando que el mostrador lo cargue.
export type PilotoFondoState = {
  orders: PilotoFondoOrder[];
  draftItems: PilotoFondoItemDto[];
  draftClaimed: boolean;
  pendingUnknownBarcode: string | null;
};

function parseItems(raw: string | PilotoFondoItemDto[] | null | undefined): PilotoFondoItemDto[] {
  if (!raw) return [];
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

// Lo nuevo entre "current" (lo que hay ahora) y "delivered" (lo que ya se
// le entrego a alguna caja): por cada producto, solo la cantidad de mas.
// Nunca negativo -- si el borrador bajo una cantidad despues de entregada
// (alguien le dio "-" en la tablet a algo que el mostrador ya se llevo),
// no hay forma de "desentregarlo", asi que se ignora esa baja.
function diffItems(current: PilotoFondoItemDto[], delivered: PilotoFondoItemDto[]): PilotoFondoItemDto[] {
  const deliveredQuantities = new Map(delivered.map((item) => [item.productId, item.quantity]));
  const delta: PilotoFondoItemDto[] = [];
  for (const item of current) {
    const already = deliveredQuantities.get(item.productId) ?? 0;
    const extra = item.quantity - already;
    if (extra > 0) delta.push({ ...item, quantity: extra });
  }
  return delta;
}

const DRAFT_ID = 1;

// Venta del "fondo" (30/10/2026, extendido 03/11/2026 con "tomar y seguir
// recibiendo"): la tablet del fondo guarda en la fila 1 lo que va
// escaneando (el "borrador") y el mostrador lo lee cada pocos segundos.
//
// Antes, "tomar" el borrador lo vaciaba de una. Pedido explicito
// (03/11/2026): "si yo quiero, lo agarro... y si ella sigue pasando, me
// sigue sumando en el mio... cuando le de enviar, ahi cortaria". Ahora
// "tomar" (claim) marca el borrador como reclamado y entrega lo que haya
// hasta el momento; de ahi en mas, cada sincronizacion (sync) entrega solo
// lo NUEVO desde la ultima vez (delivered_items guarda la ultima foto ya
// entregada). "Enviar" con el borrador reclamado no crea un Pedido nuevo
// (ya se esta entregando en vivo) -- solo marca "closing", y la ultima
// sincronizacion que alcance a entregar todo lo pendiente cierra y vacia
// la fila. Si nadie lo reclamo, "Enviar" sigue funcionando como siempre:
// un Pedido nuevo esperando en la bandeja.
@Injectable()
export class PilotoFondoService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getState(): Promise<PilotoFondoState> {
    const rows = await this.databaseService.query<FondoRow[]>(
      `SELECT id, items, DATE_FORMAT(sent_at, '%Y-%m-%dT%H:%i:%s') AS sent_at, claimed, pending_unknown_barcode
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
      draftClaimed: Boolean(draft?.claimed),
      pendingUnknownBarcode: draft?.pending_unknown_barcode ?? null
    };
  }

  // La tablet guarda lo que va pasando (borrador). No toca claimed/closing:
  // seguir escaneando con el borrador reclamado es exactamente el punto.
  async saveDraft(items: PilotoFondoItemDto[]): Promise<PilotoFondoState> {
    await this.databaseService.execute(
      `INSERT INTO saas_piloto_fondo_cart (id, items, sent_at, updated_at) VALUES (1, ?, NULL, NOW())
       ON DUPLICATE KEY UPDATE items = VALUES(items), sent_at = NULL, updated_at = NOW()`,
      [JSON.stringify(items)]
    );
    return this.getState();
  }

  // "Tomar y seguir recibiendo" (primer click) y las sincronizaciones de
  // ahi en mas (claim=false): devuelve SOLO lo nuevo desde la ultima vez
  // (nunca la foto completa, que ya se suma aparte en la caja -- sumarla
  // de nuevo la duplicaria). Si quedaba "closing" pendiente y esta
  // sincronizacion alcanza a entregar todo, cierra el borrador: lo deja
  // vacio y sin reclamar, listo para el proximo cliente.
  async syncDraft(claim: boolean): Promise<{ items: PilotoFondoItemDto[]; closed: boolean }> {
    return this.databaseService.withTransaction(async (connection) => {
      const [rows] = await connection.query<FondoRow[]>("SELECT * FROM saas_piloto_fondo_cart WHERE id = ? FOR UPDATE", [DRAFT_ID]);
      const row = rows[0];
      if (!row) return { items: [], closed: false };

      const isClaimed = Boolean(row.claimed);
      if (!isClaimed && !claim) return { items: [], closed: false };

      const current = parseItems(row.items);
      const delivered = parseItems(row.delivered_items);
      const delta = diffItems(current, delivered);

      // Ya se entrego todo lo que habia Y la tablet aprieto Enviar
      // mientras tanto: se cierra, vacio y sin reclamar.
      if (row.closing && delta.length === 0) {
        await connection.query(
          `UPDATE saas_piloto_fondo_cart
           SET items = JSON_ARRAY(), claimed = 0, delivered_items = NULL, closing = 0, sent_at = NULL, updated_at = NOW()
           WHERE id = ?`,
          [DRAFT_ID]
        );
        return { items: [], closed: true };
      }

      await connection.query(
        `UPDATE saas_piloto_fondo_cart SET claimed = 1, delivered_items = ?, updated_at = NOW() WHERE id = ?`,
        [JSON.stringify(current), DRAFT_ID]
      );
      return { items: delta, closed: false };
    });
  }

  // "Enviar al mostrador": si nadie reclamo el borrador, un pedido nuevo
  // al final de la fila (como siempre). Si YA esta reclamado, no hace
  // falta crear nada -- se viene entregando en vivo -- solo se marca
  // "closing" para que la proxima sincronizacion, al entregar lo ultimo
  // que falte, cierre y vacie.
  async sendOrder(items: PilotoFondoItemDto[]): Promise<PilotoFondoState> {
    await this.databaseService.withTransaction(async (connection) => {
      await connection.query(
        `INSERT INTO saas_piloto_fondo_cart (id, items, sent_at, updated_at) VALUES (1, JSON_ARRAY(), NULL, NOW())
         ON DUPLICATE KEY UPDATE updated_at = updated_at`
      );
      const [rows] = await connection.query<FondoRow[]>("SELECT claimed FROM saas_piloto_fondo_cart WHERE id = 1 FOR UPDATE");
      const isClaimed = Boolean(rows[0]?.claimed);

      if (isClaimed) {
        await connection.query(`UPDATE saas_piloto_fondo_cart SET items = ?, closing = 1, updated_at = NOW() WHERE id = 1`, [
          JSON.stringify(items)
        ]);
        return;
      }

      if (!items.length) return;
      await connection.query("DELETE FROM saas_piloto_fondo_cart WHERE id > 1 AND JSON_LENGTH(items) = 0");
      const [maxRows] = await connection.query<FondoRow[]>("SELECT COALESCE(MAX(id), 1) AS id FROM saas_piloto_fondo_cart WHERE id > 1");
      const nextId = Number(maxRows[0].id) + 1;
      await connection.query("INSERT INTO saas_piloto_fondo_cart (id, items, sent_at, updated_at) VALUES (?, ?, NOW(), NOW())", [
        nextId,
        JSON.stringify(items)
      ]);
      await connection.query("UPDATE saas_piloto_fondo_cart SET items = JSON_ARRAY(), sent_at = NULL, updated_at = NOW() WHERE id = 1");
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

  // La tablet escaneo algo que no esta en el catalogo: queda avisado para
  // el mostrador (pedido explicito: "que me salga otro pop-up... y ella
  // sigue ahi"). Si ya habia uno pendiente sin resolver, este lo reemplaza
  // -- no hay cola, es un aviso puntual.
  async reportUnknownBarcode(barcode: string): Promise<void> {
    await this.databaseService.execute(
      `INSERT INTO saas_piloto_fondo_cart (id, items, pending_unknown_barcode, updated_at) VALUES (1, JSON_ARRAY(), ?, NOW())
       ON DUPLICATE KEY UPDATE pending_unknown_barcode = VALUES(pending_unknown_barcode), updated_at = NOW()`,
      [barcode]
    );
  }

  // El mostrador ya resolvio (lo cargo, o lo descarto) el aviso de este
  // codigo puntual. Compara y limpia: si mientras tanto llego un aviso
  // distinto, no se lo pisa.
  async resolveUnknownBarcode(barcode: string): Promise<void> {
    await this.databaseService.execute(
      `UPDATE saas_piloto_fondo_cart SET pending_unknown_barcode = NULL, updated_at = NOW()
       WHERE id = 1 AND pending_unknown_barcode = ?`,
      [barcode]
    );
  }
}
