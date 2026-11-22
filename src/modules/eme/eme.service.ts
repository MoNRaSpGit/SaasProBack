import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { randomBytes } from "node:crypto";
import { DatabaseService } from "../../shared/database/database.service";
import { AddEmeCategoryDto, CreateEmeClientDto, CreateEmeOrderDto, EditEmeOrderDto, EmeOrderLineDto, PatchEmeOrderDto, SaveEmeProductDto } from "./dto/eme.dto";
import { TrackEmeActivityDto } from "./dto/track-eme-activity.dto";

// EME (restaurante) con tablas propias (18/11/2026). Cada cambio sube la version
// (saas_eme_meta) y los dispositivos preguntan "cambio algo desde la version N?".
// El estado que ve la app es acotado: pedidos de los ultimos meses (no todo el
// historial), clientes con su saldo calculado, productos y repartidores.
const ORDER_WINDOW = "DATE_SUB(DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-01'), INTERVAL 1 MONTH)"; // desde el 1ro del mes pasado

const iso = (column: string) => `DATE_FORMAT(${column}, '%Y-%m-%dT%H:%i:%sZ')`;

export type EmeStateResponse = { ok: boolean; version: number; unchanged?: boolean; state: unknown | null };

@Injectable()
export class EmeService {
  constructor(private readonly databaseService: DatabaseService) {}

  // Registro interno de uso (para Movimientos): quien entro y que hizo.
  async trackActivity(dto: TrackEmeActivityDto, userAgent?: string): Promise<void> {
    await this.databaseService.execute(
      `INSERT INTO saas_eme_activity_log (visitor_id, event, detail, user_agent, occurred_at)
       VALUES (?, ?, ?, ?, UTC_TIMESTAMP())`,
      [dto.visitorId, dto.event, dto.detail?.trim() || null, userAgent?.slice(0, 255) || null]
    );
  }

  // 21/11/2026: cada usuario tiene su espacio (ws = id del usuario) con su propia version.
  // El de "nueva" es la fila id 1; los demas se crean al primer uso (id = ws + 100).
  private async getVersion(ws: number): Promise<number> {
    const rows = await this.databaseService.query<(RowDataPacket & { version: number })[]>(`SELECT version FROM saas_eme_meta WHERE workspace_id = ?`, [ws]);
    return Number(rows[0]?.version ?? 0);
  }

  private async bump(ws: number, connection?: PoolConnection) {
    const insert = `INSERT IGNORE INTO saas_eme_meta (id, version, workspace_id) VALUES (?, 0, ?)`;
    const sql = `UPDATE saas_eme_meta SET version = version + 1 WHERE workspace_id = ?`;
    if (connection) {
      await connection.query(insert, [ws + 100, ws]);
      await connection.query(sql, [ws]);
    } else {
      await this.databaseService.execute(insert, [ws + 100, ws]);
      await this.databaseService.execute(sql, [ws]);
    }
  }

  // ---------------- Lectura ----------------

  async getState(ws: number, since: number | null): Promise<EmeStateResponse> {
    await this.ensureRegister(ws);
    const version = await this.getVersion(ws);
    if (since !== null && since === version) return { ok: true, version, unchanged: true, state: null };
    return { ok: true, version, state: { ...(await this.buildState(ws)), register: await this.registerState(ws) } };
  }

  private async buildState(ws: number) {
    const [categories, products, ingredients, couriers, clients, payments, orders, items, mods] = await Promise.all([
      this.databaseService.query<(RowDataPacket & { id: number; name: string })[]>(`SELECT id, name FROM saas_eme_categories WHERE workspace_id = ? ORDER BY position, id`, [ws]),
      this.databaseService.query<(RowDataPacket & { id: string; category: string; name: string; price: string; cost: string; emoji: string })[]>(
        `SELECT p.id, c.name AS category, p.name, p.price, p.cost, p.emoji
         FROM saas_eme_products p JOIN saas_eme_categories c ON c.id = p.category_id
         WHERE p.active = 1 AND p.workspace_id = ? ORDER BY p.position, p.created_at`,
        [ws]
      ),
      this.databaseService.query<(RowDataPacket & { product_id: string; name: string })[]>(
        `SELECT i.product_id, i.name FROM saas_eme_product_ingredients i JOIN saas_eme_products p ON p.id = i.product_id WHERE p.workspace_id = ? ORDER BY i.position, i.id`,
        [ws]
      ),
      this.databaseService.query<(RowDataPacket & { id: number; name: string })[]>(`SELECT id, name FROM saas_eme_couriers WHERE active = 1 AND workspace_id = ? ORDER BY id`, [ws]),
      this.databaseService.query<(RowDataPacket & { id: number; name: string; phone: string; address: string; balance: string })[]>(
        `SELECT c.id, c.name, c.phone, c.address,
                GREATEST(0, COALESCE((SELECT SUM(o.total) FROM saas_eme_orders o WHERE o.client_id = c.id AND o.payment = 'cuenta' AND o.status <> 'rechazado'), 0)
                          - COALESCE((SELECT SUM(p.amount) FROM saas_eme_client_payments p WHERE p.client_id = c.id), 0)) AS balance
         FROM saas_eme_clients c WHERE c.workspace_id = ? ORDER BY c.name`,
        [ws]
      ),
      this.databaseService.query<(RowDataPacket & { client_id: number; paid_at: string; amount: string })[]>(
        `SELECT p.client_id, ${iso("p.paid_at")} AS paid_at, p.amount FROM saas_eme_client_payments p JOIN saas_eme_clients c ON c.id = p.client_id WHERE c.workspace_id = ? ORDER BY p.paid_at DESC, p.id DESC`,
        [ws]
      ),
      this.databaseService.query<(RowDataPacket & Record<string, unknown>)[]>(
        `SELECT id, number, channel, kind, status, table_no, note, client_name, phone, address, payment, client_id, courier_id, total, cost,
                ${iso("created_at")} AS created_at, ${iso("delivered_at")} AS delivered_at
         FROM saas_eme_orders WHERE workspace_id = ? AND created_at >= ${ORDER_WINDOW} ORDER BY created_at, number`,
        [ws]
      ),
      this.databaseService.query<(RowDataPacket & { id: number; order_id: string; product_id: string | null; name: string; base_name: string | null; price: string; qty: number; note: string | null })[]>(
        `SELECT i.id, i.order_id, i.product_id, i.name, i.base_name, i.price, i.qty, i.note
         FROM saas_eme_order_items i JOIN saas_eme_orders o ON o.id = i.order_id
         WHERE o.workspace_id = ? AND o.created_at >= ${ORDER_WINDOW} ORDER BY i.order_id, i.position, i.id`,
        [ws]
      ),
      this.databaseService.query<(RowDataPacket & { item_id: number; kind: string; label: string })[]>(
        `SELECT m.item_id, m.kind, m.label
         FROM saas_eme_order_item_mods m JOIN saas_eme_order_items i ON i.id = m.item_id JOIN saas_eme_orders o ON o.id = i.order_id
         WHERE o.workspace_id = ? AND o.created_at >= ${ORDER_WINDOW} ORDER BY m.id`,
        [ws]
      )
    ]);

    const ingredientsByProduct = new Map<string, string[]>();
    for (const row of ingredients) ingredientsByProduct.set(row.product_id, [...(ingredientsByProduct.get(row.product_id) ?? []), row.name]);
    const paymentsByClient = new Map<number, { date: string; amount: number }[]>();
    for (const row of payments) paymentsByClient.set(row.client_id, [...(paymentsByClient.get(row.client_id) ?? []), { date: row.paid_at, amount: Number(row.amount) }]);
    const modsByItem = new Map<number, { extras: string[]; removed: string[] }>();
    for (const row of mods) {
      const entry = modsByItem.get(row.item_id) ?? { extras: [], removed: [] };
      (row.kind === "extra" ? entry.extras : entry.removed).push(row.label);
      modsByItem.set(row.item_id, entry);
    }
    const linesByOrder = new Map<string, unknown[]>();
    for (const row of items) {
      const entry = modsByItem.get(row.id);
      linesByOrder.set(row.order_id, [
        ...(linesByOrder.get(row.order_id) ?? []),
        {
          productId: row.product_id ?? "",
          name: row.name,
          baseName: row.base_name ?? undefined,
          note: row.note ?? undefined,
          price: Number(row.price),
          qty: row.qty,
          extras: entry?.extras ?? [],
          removed: entry?.removed ?? []
        }
      ]);
    }

    return {
      categories: categories.map((row) => row.name),
      products: products.map((row) => ({
        id: row.id,
        category: row.category,
        name: row.name,
        price: Number(row.price),
        cost: Number(row.cost),
        emoji: row.emoji,
        ingredients: ingredientsByProduct.get(row.id) ?? []
      })),
      couriers: couriers.map((row) => ({ id: row.id, name: row.name })),
      clients: clients.map((row) => ({
        id: row.id,
        name: row.name,
        phone: row.phone,
        address: row.address,
        balance: Number(row.balance),
        payments: paymentsByClient.get(row.id) ?? []
      })),
      orders: orders.map((row) => ({
        id: row.id,
        number: row.number,
        channel: row.channel,
        kind: row.kind,
        status: row.status,
        table: row.table_no ?? null,
        lines: linesByOrder.get(String(row.id)) ?? [],
        note: row.note,
        clientName: row.client_name,
        phone: row.phone,
        address: row.address,
        payment: row.payment,
        clientId: row.client_id ?? null,
        courierId: row.courier_id ?? null,
        total: Number(row.total),
        cost: Number(row.cost),
        createdAt: row.created_at,
        deliveredAt: row.delivered_at ?? null
      }))
    };
  }

  // Todas las escrituras devuelven el estado fresco (acotado) para que la pantalla se actualice.
  private async fresh(ws: number): Promise<EmeStateResponse> {
    const version = await this.getVersion(ws);
    return { ok: true, version, state: { ...(await this.buildState(ws)), register: await this.registerState(ws) } };
  }

  // ---------------- Pedidos ----------------

  private async linesCost(connection: PoolConnection, lines: EmeOrderLineDto[]): Promise<number> {
    let cost = 0;
    for (const line of lines) {
      const [rows] = await connection.query<(RowDataPacket & { cost: string })[]>(`SELECT cost FROM saas_eme_products WHERE id = ?`, [line.productId]);
      cost += (Number(rows[0]?.cost ?? 0) + (line.extraCost ?? 0)) * line.qty;
    }
    return cost;
  }

  private async insertLines(connection: PoolConnection, orderId: string, lines: EmeOrderLineDto[]) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const [item] = await connection.query<ResultSetHeader>(
        `INSERT INTO saas_eme_order_items (order_id, position, product_id, name, base_name, price, qty, note)
         VALUES (?, ?, (SELECT id FROM saas_eme_products WHERE id = ?), ?, ?, ?, ?, ?)`,
        [orderId, i, line.productId, line.name, line.baseName ?? null, line.price, line.qty, line.note?.trim() || null]
      );
      for (const label of line.extras ?? []) await connection.query(`INSERT INTO saas_eme_order_item_mods (item_id, kind, label) VALUES (?, 'extra', ?)`, [item.insertId, label]);
      for (const label of line.removed ?? []) await connection.query(`INSERT INTO saas_eme_order_item_mods (item_id, kind, label) VALUES (?, 'removed', ?)`, [item.insertId, label]);
    }
  }

  // Editar pedido (20/11/2026): reemplaza los productos y recalcula total y costo.
  // No se puede editar un pedido rechazado/anulado.
  async editOrder(ws: number, id: string, dto: EditEmeOrderDto): Promise<EmeStateResponse> {
    await this.databaseService.withTransaction(async (connection) => {
      const [rows] = await connection.query<(RowDataPacket & { status: string })[]>(`SELECT status FROM saas_eme_orders WHERE id = ? AND workspace_id = ? FOR UPDATE`, [id, ws]);
      if (!rows[0]) throw new NotFoundException("Pedido no encontrado.");
      if (rows[0].status === "rechazado") throw new BadRequestException("Ese pedido está anulado.");
      const total = dto.lines.reduce((sum, line) => sum + line.price * line.qty, 0);
      const cost = await this.linesCost(connection, dto.lines);
      await connection.query(`DELETE m FROM saas_eme_order_item_mods m JOIN saas_eme_order_items i ON i.id = m.item_id WHERE i.order_id = ?`, [id]);
      await connection.query(`DELETE FROM saas_eme_order_items WHERE order_id = ?`, [id]);
      await this.insertLines(connection, id, dto.lines);
      await connection.query(`UPDATE saas_eme_orders SET total = ?, cost = ? WHERE id = ?`, [total, cost, id]);
      await this.bump(ws, connection);
    });
    return this.fresh(ws);
  }

  async createOrder(ws: number, dto: CreateEmeOrderDto): Promise<EmeStateResponse & { orderNumber: number }> {
    const orderNumber = await this.databaseService.withTransaction(async (connection) => {
      const [numberRows] = await connection.query<(RowDataPacket & { next: number })[]>(`SELECT COALESCE(MAX(number), 0) + 1 AS next FROM saas_eme_orders WHERE workspace_id = ? FOR UPDATE`, [ws]);
      const number = Number(numberRows[0].next);
      const total = dto.lines.reduce((sum, line) => sum + line.price * line.qty, 0);

      // Costo: el de cada producto en el menu (los renglones de un producto borrado cuentan 0).
      const cost = await this.linesCost(connection, dto.lines);

      // Cuenta corriente: el cliente elegido, o el que coincide por nombre; si no existe, se crea.
      let clientId: number | null = null;
      if ((dto.payment ?? "efectivo") === "cuenta") {
        const name = (dto.clientName ?? "").trim();
        if (dto.clientId) {
          const [found] = await connection.query<(RowDataPacket & { id: number })[]>(`SELECT id FROM saas_eme_clients WHERE id = ? AND workspace_id = ?`, [dto.clientId, ws]);
          clientId = found[0]?.id ?? null;
        }
        if (!clientId && name) {
          const [found] = await connection.query<(RowDataPacket & { id: number })[]>(`SELECT id FROM saas_eme_clients WHERE workspace_id = ? AND LOWER(name) = LOWER(?) LIMIT 1`, [ws, name]);
          if (found[0]) clientId = found[0].id;
          else {
            const [created] = await connection.query<ResultSetHeader>(`INSERT INTO saas_eme_clients (name, phone, address, workspace_id) VALUES (?, ?, ?, ?)`, [name, dto.phone ?? "", dto.address ?? "", ws]);
            clientId = created.insertId;
          }
        }
        if (!clientId) throw new BadRequestException("Para cuenta corriente elegí o escribí el nombre del cliente.");
      }

      // "nueva" (id 2) conserva los ids de siempre (o<n>); los otros espacios llevan sufijo para no chocar.
      const id = ws === 2 ? `o${number}` : `o${number}w${ws}`;
      await connection.query(
        `INSERT INTO saas_eme_orders (id, number, channel, kind, status, table_no, note, client_name, phone, address, payment, client_id, total, cost, created_at, workspace_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), ?)`,
        [
          id,
          number,
          dto.channel,
          dto.kind,
          // Lo que levanta la mesa lo acepta la caja; lo que ingresa la caja entra aceptado.
          dto.channel === "mesa" ? "por_aceptar" : "aceptado",
          dto.table ?? null,
          (dto.note ?? "").trim(),
          (dto.clientName ?? "").trim(),
          (dto.phone ?? "").trim(),
          (dto.address ?? "").trim(),
          dto.payment ?? "efectivo",
          clientId,
          total,
          cost,
          ws
        ]
      );
      await this.insertLines(connection, id, dto.lines);
      await this.bump(ws, connection);
      return number;
    });
    return { ...(await this.fresh(ws)), orderNumber };
  }

  async patchOrder(ws: number, id: string, dto: PatchEmeOrderDto): Promise<EmeStateResponse> {
    let result: ResultSetHeader;
    if (dto.action === "accept") {
      result = await this.databaseService.execute<ResultSetHeader>(`UPDATE saas_eme_orders SET status = 'aceptado' WHERE id = ? AND workspace_id = ? AND status = 'por_aceptar'`, [id, ws]);
    } else if (dto.action === "reject") {
      result = await this.databaseService.execute<ResultSetHeader>(`UPDATE saas_eme_orders SET status = 'rechazado' WHERE id = ? AND workspace_id = ? AND status = 'por_aceptar'`, [id, ws]);
    } else if (dto.action === "cancel") {
      // Anular (20/11/2026): cualquier pedido no anulado pasa a rechazado (deja de sumar).
      result = await this.databaseService.execute<ResultSetHeader>(`UPDATE saas_eme_orders SET status = 'rechazado' WHERE id = ? AND workspace_id = ? AND status <> 'rechazado'`, [id, ws]);
    } else if (dto.action === "kind") {
      if (!dto.kind) throw new BadRequestException("Falta mostrador o delivery.");
      // Solo mientras se prepara; si pasa a mostrador se le saca el repartidor.
      result = await this.databaseService.execute<ResultSetHeader>(
        `UPDATE saas_eme_orders SET kind = ?, courier_id = NULL WHERE id = ? AND workspace_id = ? AND status = 'aceptado' AND kind <> 'salon'`,
        [dto.kind, id, ws]
      );
    } else if (dto.action === "courier") {
      if (!dto.courierId) throw new BadRequestException("Falta el repartidor.");
      const couriers = await this.databaseService.query<(RowDataPacket & { id: number })[]>(`SELECT id FROM saas_eme_couriers WHERE id = ? AND active = 1 AND workspace_id = ?`, [dto.courierId, ws]);
      if (!couriers[0]) throw new BadRequestException("Ese repartidor no existe.");
      result = await this.databaseService.execute<ResultSetHeader>(
        `UPDATE saas_eme_orders SET courier_id = ?, status = 'en_camino' WHERE id = ? AND workspace_id = ? AND status IN ('aceptado','en_camino')`,
        [dto.courierId, id, ws]
      );
    } else {
      result = await this.databaseService.execute<ResultSetHeader>(
        `UPDATE saas_eme_orders SET status = 'entregado', delivered_at = UTC_TIMESTAMP() WHERE id = ? AND workspace_id = ? AND status IN ('aceptado','en_camino')`,
        [id, ws]
      );
    }
    if (result.affectedRows === 0) {
      const exists = await this.databaseService.query<RowDataPacket[]>(`SELECT id FROM saas_eme_orders WHERE id = ? AND workspace_id = ?`, [id, ws]);
      if (!exists[0]) throw new NotFoundException("Pedido no encontrado.");
      // El pedido ya cambio de estado en otro dispositivo: no se pisa, se devuelve lo actual.
      return this.fresh(ws);
    }
    await this.bump(ws);
    return this.fresh(ws);
  }

  // ---------------- Clientes de cuenta corriente ----------------

  async createClient(ws: number, dto: CreateEmeClientDto): Promise<EmeStateResponse> {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException("Poné el nombre del cliente.");
    const existing = await this.databaseService.query<RowDataPacket[]>(`SELECT id FROM saas_eme_clients WHERE workspace_id = ? AND LOWER(name) = LOWER(?) LIMIT 1`, [ws, name]);
    if (existing[0]) throw new BadRequestException("Ya existe un cliente con ese nombre.");
    await this.databaseService.execute(`INSERT INTO saas_eme_clients (name, phone, address, workspace_id) VALUES (?, ?, ?, ?)`, [name, (dto.phone ?? "").trim(), (dto.address ?? "").trim(), ws]);
    await this.bump(ws);
    return this.fresh(ws);
  }

  async registerPayment(ws: number, clientId: number, amount: number): Promise<EmeStateResponse> {
    const exists = await this.databaseService.query<RowDataPacket[]>(`SELECT id FROM saas_eme_clients WHERE id = ? AND workspace_id = ?`, [clientId, ws]);
    if (!exists[0]) throw new NotFoundException("Cliente no encontrado.");
    await this.databaseService.execute(`INSERT INTO saas_eme_client_payments (client_id, amount, paid_at) VALUES (?, ?, UTC_TIMESTAMP())`, [clientId, amount]);
    await this.bump(ws);
    return this.fresh(ws);
  }

  // ---------------- Productos y categorias ----------------

  private async categoryId(connection: PoolConnection, ws: number, name: string): Promise<number> {
    const clean = name.trim();
    const [found] = await connection.query<(RowDataPacket & { id: number })[]>(`SELECT id FROM saas_eme_categories WHERE workspace_id = ? AND LOWER(name) = LOWER(?) LIMIT 1`, [ws, clean]);
    if (found[0]) return found[0].id;
    const [position] = await connection.query<(RowDataPacket & { next: number })[]>(`SELECT COALESCE(MAX(position), -1) + 1 AS next FROM saas_eme_categories WHERE workspace_id = ?`, [ws]);
    const [created] = await connection.query<ResultSetHeader>(`INSERT INTO saas_eme_categories (name, position, workspace_id) VALUES (?, ?, ?)`, [clean, position[0].next, ws]);
    return created.insertId;
  }

  private async saveIngredients(connection: PoolConnection, productId: string, ingredients: string[] | undefined) {
    await connection.query(`DELETE FROM saas_eme_product_ingredients WHERE product_id = ?`, [productId]);
    const clean = (ingredients ?? []).map((item) => item.trim()).filter(Boolean);
    for (let i = 0; i < clean.length; i++) {
      await connection.query(`INSERT INTO saas_eme_product_ingredients (product_id, position, name) VALUES (?, ?, ?)`, [productId, i, clean[i]]);
    }
  }

  async createProduct(ws: number, dto: SaveEmeProductDto): Promise<EmeStateResponse> {
    await this.databaseService.withTransaction(async (connection) => {
      const categoryId = await this.categoryId(connection, ws, dto.category);
      const id = `p${Date.now().toString(36)}${randomBytes(2).toString("hex")}`;
      const [position] = await connection.query<(RowDataPacket & { next: number })[]>(`SELECT COALESCE(MAX(position), -1) + 1 AS next FROM saas_eme_products WHERE workspace_id = ?`, [ws]);
      await connection.query(`INSERT INTO saas_eme_products (id, category_id, name, price, cost, emoji, position, workspace_id) VALUES (?, ?, ?, ?, ?, '🍽', ?, ?)`, [
        id,
        categoryId,
        dto.name.trim(),
        dto.price,
        Math.min(dto.cost ?? 0, dto.price),
        position[0].next,
        ws
      ]);
      await this.saveIngredients(connection, id, dto.ingredients);
      await this.bump(ws, connection);
    });
    return this.fresh(ws);
  }

  async updateProduct(ws: number, id: string, dto: SaveEmeProductDto): Promise<EmeStateResponse> {
    await this.databaseService.withTransaction(async (connection) => {
      const [exists] = await connection.query<RowDataPacket[]>(`SELECT id FROM saas_eme_products WHERE id = ? AND active = 1 AND workspace_id = ?`, [id, ws]);
      if (!exists[0]) throw new NotFoundException("Producto no encontrado.");
      const categoryId = await this.categoryId(connection, ws, dto.category);
      await connection.query(`UPDATE saas_eme_products SET category_id = ?, name = ?, price = ?, cost = COALESCE(?, cost) WHERE id = ?`, [
        categoryId,
        dto.name.trim(),
        dto.price,
        dto.cost === undefined ? null : Math.min(dto.cost, dto.price),
        id
      ]);
      await this.saveIngredients(connection, id, dto.ingredients);
      await this.bump(ws, connection);
    });
    return this.fresh(ws);
  }

  async deleteProduct(ws: number, id: string): Promise<EmeStateResponse> {
    const result = await this.databaseService.execute<ResultSetHeader>(`UPDATE saas_eme_products SET active = 0 WHERE id = ? AND active = 1 AND workspace_id = ?`, [id, ws]);
    if (result.affectedRows === 0) throw new NotFoundException("Producto no encontrado.");
    await this.bump(ws);
    return this.fresh(ws);
  }

  async addCategory(ws: number, dto: AddEmeCategoryDto): Promise<EmeStateResponse> {
    await this.databaseService.withTransaction(async (connection) => {
      await this.categoryId(connection, ws, dto.name);
      await this.bump(ws, connection);
    });
    return this.fresh(ws);
  }
  // ---------------- Caja (19/11/2026) ----------------
  // Un turno de caja abierto a la vez. Se cierra a mano o solo a las 5 am de
  // Montevideo (08:00 UTC): el primer pedido de estado despues de esa hora lo
  // cierra y abre uno nuevo vacio.

  private businessDayStart(now = new Date()): string {
    // 20/11/2026: corte pasado de las 3 a las 5 am de Montevideo (08:00 UTC).
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 8, 0, 0));
    if (now.getTime() < start.getTime()) start.setUTCDate(start.getUTCDate() - 1);
    return start.toISOString().slice(0, 19).replace("T", " ");
  }

  private async ensureRegister(ws: number): Promise<void> {
    const boundary = this.businessDayStart();
    const check = `SELECT id, opened_at < ? AS stale FROM saas_eme_register_sessions WHERE closed_at IS NULL AND workspace_id = ? ORDER BY id DESC LIMIT 1`;
    const rows = await this.databaseService.query<(RowDataPacket & { id: number; stale: number })[]>(check, [boundary, ws]);
    if (rows[0] && !Number(rows[0].stale)) return;
    await this.databaseService.withTransaction(async (connection) => {
      const [open] = await connection.query<(RowDataPacket & { id: number; stale: number })[]>(check + " FOR UPDATE", [boundary, ws]);
      if (open[0] && !Number(open[0].stale)) return;
      if (open[0]) {
        await connection.query(`UPDATE saas_eme_register_sessions SET closed_at = ?, closed_by = 'auto' WHERE closed_at IS NULL AND workspace_id = ?`, [boundary, ws]);
      }
      await connection.query(`INSERT INTO saas_eme_register_sessions (opened_at, opening_amount, workspace_id) VALUES (?, 0, ?)`, [boundary, ws]);
      await this.bump(ws, connection);
    });
  }

  private async currentRegisterId(ws: number): Promise<number> {
    await this.ensureRegister(ws);
    const rows = await this.databaseService.query<(RowDataPacket & { id: number })[]>(
      `SELECT id FROM saas_eme_register_sessions WHERE closed_at IS NULL AND workspace_id = ? ORDER BY id DESC LIMIT 1`,
      [ws]
    );
    if (!rows[0]) throw new BadRequestException("No hay caja abierta.");
    return rows[0].id;
  }

  private async registerState(ws: number) {
    const sessions = await this.databaseService.query<(RowDataPacket & { id: number; opened_at: string; opening_amount: string; opening_set: number })[]>(
      `SELECT id, ${iso("opened_at")} AS opened_at, opening_amount, opening_set FROM saas_eme_register_sessions WHERE closed_at IS NULL AND workspace_id = ? ORDER BY id DESC LIMIT 1`,
      [ws]
    );
    const session = sessions[0];
    if (!session) return null;
    const expenses = await this.databaseService.query<(RowDataPacket & { id: number; description: string; amount: string; created_at: string })[]>(
      `SELECT id, description, amount, ${iso("created_at")} AS created_at FROM saas_eme_register_expenses WHERE session_id = ? ORDER BY id`,
      [session.id]
    );
    return {
      id: session.id,
      openedAt: session.opened_at,
      openingAmount: Number(session.opening_amount),
      openingSet: Boolean(session.opening_set),
      expenses: expenses.map((row) => ({ id: row.id, description: row.description, amount: Number(row.amount), createdAt: row.created_at }))
    };
  }

  async setOpening(ws: number, amount: number): Promise<EmeStateResponse> {
    const id = await this.currentRegisterId(ws);
    await this.databaseService.execute(`UPDATE saas_eme_register_sessions SET opening_amount = ?, opening_set = 1 WHERE id = ?`, [amount, id]);
    await this.bump(ws);
    return this.fresh(ws);
  }

  async addExpense(ws: number, description: string, amount: number): Promise<EmeStateResponse> {
    const id = await this.currentRegisterId(ws);
    await this.databaseService.execute(
      `INSERT INTO saas_eme_register_expenses (session_id, description, amount, created_at) VALUES (?, ?, ?, UTC_TIMESTAMP())`,
      [id, description.trim(), amount]
    );
    await this.bump(ws);
    return this.fresh(ws);
  }

  async deleteExpense(ws: number, expenseId: number): Promise<EmeStateResponse> {
    const id = await this.currentRegisterId(ws);
    const result = await this.databaseService.execute<ResultSetHeader>(`DELETE FROM saas_eme_register_expenses WHERE id = ? AND session_id = ?`, [expenseId, id]);
    if (result.affectedRows === 0) throw new NotFoundException("Gasto no encontrado.");
    await this.bump(ws);
    return this.fresh(ws);
  }

  // Cierre manual: cierra el turno y abre uno nuevo vacio desde ahora.
  async closeRegister(ws: number): Promise<EmeStateResponse> {
    await this.ensureRegister(ws);
    await this.databaseService.withTransaction(async (connection) => {
      await connection.query(`UPDATE saas_eme_register_sessions SET closed_at = UTC_TIMESTAMP(), closed_by = 'manual' WHERE closed_at IS NULL AND workspace_id = ?`, [ws]);
      await connection.query(`INSERT INTO saas_eme_register_sessions (opened_at, opening_amount, workspace_id) VALUES (UTC_TIMESTAMP(), 0, ?)`, [ws]);
      await this.bump(ws, connection);
    });
    return this.fresh(ws);
  }
}
