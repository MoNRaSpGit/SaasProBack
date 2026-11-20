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

  private async getVersion(): Promise<number> {
    const rows = await this.databaseService.query<(RowDataPacket & { version: number })[]>(`SELECT version FROM saas_eme_meta WHERE id = 1`);
    return Number(rows[0]?.version ?? 0);
  }

  private async bump(connection?: PoolConnection) {
    const sql = `UPDATE saas_eme_meta SET version = version + 1 WHERE id = 1`;
    if (connection) await connection.query(sql);
    else await this.databaseService.execute(sql);
  }

  // ---------------- Lectura ----------------

  async getState(since: number | null): Promise<EmeStateResponse> {
    await this.ensureRegister();
    const version = await this.getVersion();
    if (since !== null && since === version) return { ok: true, version, unchanged: true, state: null };
    return { ok: true, version, state: { ...(await this.buildState()), register: await this.registerState() } };
  }

  private async buildState() {
    const [categories, products, ingredients, couriers, clients, payments, orders, items, mods] = await Promise.all([
      this.databaseService.query<(RowDataPacket & { id: number; name: string })[]>(`SELECT id, name FROM saas_eme_categories ORDER BY position, id`),
      this.databaseService.query<(RowDataPacket & { id: string; category: string; name: string; price: string; cost: string; emoji: string })[]>(
        `SELECT p.id, c.name AS category, p.name, p.price, p.cost, p.emoji
         FROM saas_eme_products p JOIN saas_eme_categories c ON c.id = p.category_id
         WHERE p.active = 1 ORDER BY p.position, p.created_at`
      ),
      this.databaseService.query<(RowDataPacket & { product_id: string; name: string })[]>(
        `SELECT product_id, name FROM saas_eme_product_ingredients ORDER BY position, id`
      ),
      this.databaseService.query<(RowDataPacket & { id: number; name: string })[]>(`SELECT id, name FROM saas_eme_couriers WHERE active = 1 ORDER BY id`),
      this.databaseService.query<(RowDataPacket & { id: number; name: string; phone: string; address: string; balance: string })[]>(
        `SELECT c.id, c.name, c.phone, c.address,
                GREATEST(0, COALESCE((SELECT SUM(o.total) FROM saas_eme_orders o WHERE o.client_id = c.id AND o.payment = 'cuenta' AND o.status <> 'rechazado'), 0)
                          - COALESCE((SELECT SUM(p.amount) FROM saas_eme_client_payments p WHERE p.client_id = c.id), 0)) AS balance
         FROM saas_eme_clients c ORDER BY c.name`
      ),
      this.databaseService.query<(RowDataPacket & { client_id: number; paid_at: string; amount: string })[]>(
        `SELECT client_id, ${iso("paid_at")} AS paid_at, amount FROM saas_eme_client_payments ORDER BY paid_at DESC, id DESC`
      ),
      this.databaseService.query<(RowDataPacket & Record<string, unknown>)[]>(
        `SELECT id, number, channel, kind, status, table_no, note, client_name, phone, address, payment, client_id, courier_id, total, cost,
                ${iso("created_at")} AS created_at, ${iso("delivered_at")} AS delivered_at
         FROM saas_eme_orders WHERE created_at >= ${ORDER_WINDOW} ORDER BY created_at, number`
      ),
      this.databaseService.query<(RowDataPacket & { id: number; order_id: string; product_id: string | null; name: string; base_name: string | null; price: string; qty: number })[]>(
        `SELECT i.id, i.order_id, i.product_id, i.name, i.base_name, i.price, i.qty
         FROM saas_eme_order_items i JOIN saas_eme_orders o ON o.id = i.order_id
         WHERE o.created_at >= ${ORDER_WINDOW} ORDER BY i.order_id, i.position, i.id`
      ),
      this.databaseService.query<(RowDataPacket & { item_id: number; kind: string; label: string })[]>(
        `SELECT m.item_id, m.kind, m.label
         FROM saas_eme_order_item_mods m JOIN saas_eme_order_items i ON i.id = m.item_id JOIN saas_eme_orders o ON o.id = i.order_id
         WHERE o.created_at >= ${ORDER_WINDOW} ORDER BY m.id`
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
  private async fresh(): Promise<EmeStateResponse> {
    const version = await this.getVersion();
    return { ok: true, version, state: { ...(await this.buildState()), register: await this.registerState() } };
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
        `INSERT INTO saas_eme_order_items (order_id, position, product_id, name, base_name, price, qty)
         VALUES (?, ?, (SELECT id FROM saas_eme_products WHERE id = ?), ?, ?, ?, ?)`,
        [orderId, i, line.productId, line.name, line.baseName ?? null, line.price, line.qty]
      );
      for (const label of line.extras ?? []) await connection.query(`INSERT INTO saas_eme_order_item_mods (item_id, kind, label) VALUES (?, extra, ?)`, [item.insertId, label]);
      for (const label of line.removed ?? []) await connection.query(`INSERT INTO saas_eme_order_item_mods (item_id, kind, label) VALUES (?, removed, ?)`, [item.insertId, label]);
    }
  }

  // Editar pedido (20/11/2026): reemplaza los productos y recalcula total y costo.
  // No se puede editar un pedido rechazado/anulado.
  async editOrder(id: string, dto: EditEmeOrderDto): Promise<EmeStateResponse> {
    await this.databaseService.withTransaction(async (connection) => {
      const [rows] = await connection.query<(RowDataPacket & { status: string })[]>(`SELECT status FROM saas_eme_orders WHERE id = ? FOR UPDATE`, [id]);
      if (!rows[0]) throw new NotFoundException("Pedido no encontrado.");
      if (rows[0].status === "rechazado") throw new BadRequestException("Ese pedido está anulado.");
      const total = dto.lines.reduce((sum, line) => sum + line.price * line.qty, 0);
      const cost = await this.linesCost(connection, dto.lines);
      await connection.query(`DELETE m FROM saas_eme_order_item_mods m JOIN saas_eme_order_items i ON i.id = m.item_id WHERE i.order_id = ?`, [id]);
      await connection.query(`DELETE FROM saas_eme_order_items WHERE order_id = ?`, [id]);
      await this.insertLines(connection, id, dto.lines);
      await connection.query(`UPDATE saas_eme_orders SET total = ?, cost = ? WHERE id = ?`, [total, cost, id]);
      await this.bump(connection);
    });
    return this.fresh();
  }

  async createOrder(dto: CreateEmeOrderDto): Promise<EmeStateResponse & { orderNumber: number }> {
    const orderNumber = await this.databaseService.withTransaction(async (connection) => {
      const [numberRows] = await connection.query<(RowDataPacket & { next: number })[]>(`SELECT COALESCE(MAX(number), 0) + 1 AS next FROM saas_eme_orders FOR UPDATE`);
      const number = Number(numberRows[0].next);
      const total = dto.lines.reduce((sum, line) => sum + line.price * line.qty, 0);

      // Costo: el de cada producto en el menu (los renglones de un producto borrado cuentan 0).
      const cost = await this.linesCost(connection, dto.lines);

      // Cuenta corriente: el cliente elegido, o el que coincide por nombre; si no existe, se crea.
      let clientId: number | null = null;
      if ((dto.payment ?? "efectivo") === "cuenta") {
        const name = (dto.clientName ?? "").trim();
        if (dto.clientId) {
          const [found] = await connection.query<(RowDataPacket & { id: number })[]>(`SELECT id FROM saas_eme_clients WHERE id = ?`, [dto.clientId]);
          clientId = found[0]?.id ?? null;
        }
        if (!clientId && name) {
          const [found] = await connection.query<(RowDataPacket & { id: number })[]>(`SELECT id FROM saas_eme_clients WHERE LOWER(name) = LOWER(?) LIMIT 1`, [name]);
          if (found[0]) clientId = found[0].id;
          else {
            const [created] = await connection.query<ResultSetHeader>(`INSERT INTO saas_eme_clients (name, phone, address) VALUES (?, ?, ?)`, [name, dto.phone ?? "", dto.address ?? ""]);
            clientId = created.insertId;
          }
        }
        if (!clientId) throw new BadRequestException("Para cuenta corriente elegí o escribí el nombre del cliente.");
      }

      const id = `o${number}`;
      await connection.query(
        `INSERT INTO saas_eme_orders (id, number, channel, kind, status, table_no, note, client_name, phone, address, payment, client_id, total, cost, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
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
          cost
        ]
      );
      await this.insertLines(connection, id, dto.lines);
      await this.bump(connection);
      return number;
    });
    return { ...(await this.fresh()), orderNumber };
  }

  async patchOrder(id: string, dto: PatchEmeOrderDto): Promise<EmeStateResponse> {
    let result: ResultSetHeader;
    if (dto.action === "accept") {
      result = await this.databaseService.execute<ResultSetHeader>(`UPDATE saas_eme_orders SET status = 'aceptado' WHERE id = ? AND status = 'por_aceptar'`, [id]);
    } else if (dto.action === "reject") {
      result = await this.databaseService.execute<ResultSetHeader>(`UPDATE saas_eme_orders SET status = 'rechazado' WHERE id = ? AND status = 'por_aceptar'`, [id]);
    } else if (dto.action === "cancel") {
      // Anular (20/11/2026): cualquier pedido no anulado pasa a rechazado (deja de sumar).
      result = await this.databaseService.execute<ResultSetHeader>(`UPDATE saas_eme_orders SET status = 'rechazado' WHERE id = ? AND status <> 'rechazado'`, [id]);
    } else if (dto.action === "kind") {
      if (!dto.kind) throw new BadRequestException("Falta mostrador o delivery.");
      // Solo mientras se prepara; si pasa a mostrador se le saca el repartidor.
      result = await this.databaseService.execute<ResultSetHeader>(
        `UPDATE saas_eme_orders SET kind = ?, courier_id = NULL WHERE id = ? AND status = 'aceptado' AND kind <> 'salon'`,
        [dto.kind, id]
      );
    } else if (dto.action === "courier") {
      if (!dto.courierId) throw new BadRequestException("Falta el repartidor.");
      const couriers = await this.databaseService.query<(RowDataPacket & { id: number })[]>(`SELECT id FROM saas_eme_couriers WHERE id = ? AND active = 1`, [dto.courierId]);
      if (!couriers[0]) throw new BadRequestException("Ese repartidor no existe.");
      result = await this.databaseService.execute<ResultSetHeader>(
        `UPDATE saas_eme_orders SET courier_id = ?, status = 'en_camino' WHERE id = ? AND status IN ('aceptado','en_camino')`,
        [dto.courierId, id]
      );
    } else {
      result = await this.databaseService.execute<ResultSetHeader>(
        `UPDATE saas_eme_orders SET status = 'entregado', delivered_at = UTC_TIMESTAMP() WHERE id = ? AND status IN ('aceptado','en_camino')`,
        [id]
      );
    }
    if (result.affectedRows === 0) {
      const exists = await this.databaseService.query<RowDataPacket[]>(`SELECT id FROM saas_eme_orders WHERE id = ?`, [id]);
      if (!exists[0]) throw new NotFoundException("Pedido no encontrado.");
      // El pedido ya cambio de estado en otro dispositivo: no se pisa, se devuelve lo actual.
      return this.fresh();
    }
    await this.bump();
    return this.fresh();
  }

  // ---------------- Clientes de cuenta corriente ----------------

  async createClient(dto: CreateEmeClientDto): Promise<EmeStateResponse> {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException("Poné el nombre del cliente.");
    const existing = await this.databaseService.query<RowDataPacket[]>(`SELECT id FROM saas_eme_clients WHERE LOWER(name) = LOWER(?) LIMIT 1`, [name]);
    if (existing[0]) throw new BadRequestException("Ya existe un cliente con ese nombre.");
    await this.databaseService.execute(`INSERT INTO saas_eme_clients (name, phone, address) VALUES (?, ?, ?)`, [name, (dto.phone ?? "").trim(), (dto.address ?? "").trim()]);
    await this.bump();
    return this.fresh();
  }

  async registerPayment(clientId: number, amount: number): Promise<EmeStateResponse> {
    const exists = await this.databaseService.query<RowDataPacket[]>(`SELECT id FROM saas_eme_clients WHERE id = ?`, [clientId]);
    if (!exists[0]) throw new NotFoundException("Cliente no encontrado.");
    await this.databaseService.execute(`INSERT INTO saas_eme_client_payments (client_id, amount, paid_at) VALUES (?, ?, UTC_TIMESTAMP())`, [clientId, amount]);
    await this.bump();
    return this.fresh();
  }

  // ---------------- Productos y categorias ----------------

  private async categoryId(connection: PoolConnection, name: string): Promise<number> {
    const clean = name.trim();
    const [found] = await connection.query<(RowDataPacket & { id: number })[]>(`SELECT id FROM saas_eme_categories WHERE LOWER(name) = LOWER(?) LIMIT 1`, [clean]);
    if (found[0]) return found[0].id;
    const [position] = await connection.query<(RowDataPacket & { next: number })[]>(`SELECT COALESCE(MAX(position), -1) + 1 AS next FROM saas_eme_categories`);
    const [created] = await connection.query<ResultSetHeader>(`INSERT INTO saas_eme_categories (name, position) VALUES (?, ?)`, [clean, position[0].next]);
    return created.insertId;
  }

  private async saveIngredients(connection: PoolConnection, productId: string, ingredients: string[] | undefined) {
    await connection.query(`DELETE FROM saas_eme_product_ingredients WHERE product_id = ?`, [productId]);
    const clean = (ingredients ?? []).map((item) => item.trim()).filter(Boolean);
    for (let i = 0; i < clean.length; i++) {
      await connection.query(`INSERT INTO saas_eme_product_ingredients (product_id, position, name) VALUES (?, ?, ?)`, [productId, i, clean[i]]);
    }
  }

  async createProduct(dto: SaveEmeProductDto): Promise<EmeStateResponse> {
    await this.databaseService.withTransaction(async (connection) => {
      const categoryId = await this.categoryId(connection, dto.category);
      const id = `p${Date.now().toString(36)}${randomBytes(2).toString("hex")}`;
      const [position] = await connection.query<(RowDataPacket & { next: number })[]>(`SELECT COALESCE(MAX(position), -1) + 1 AS next FROM saas_eme_products`);
      await connection.query(`INSERT INTO saas_eme_products (id, category_id, name, price, cost, emoji, position) VALUES (?, ?, ?, ?, ?, '🍽', ?)`, [
        id,
        categoryId,
        dto.name.trim(),
        dto.price,
        Math.min(dto.cost ?? 0, dto.price),
        position[0].next
      ]);
      await this.saveIngredients(connection, id, dto.ingredients);
      await this.bump(connection);
    });
    return this.fresh();
  }

  async updateProduct(id: string, dto: SaveEmeProductDto): Promise<EmeStateResponse> {
    await this.databaseService.withTransaction(async (connection) => {
      const [exists] = await connection.query<RowDataPacket[]>(`SELECT id FROM saas_eme_products WHERE id = ? AND active = 1`, [id]);
      if (!exists[0]) throw new NotFoundException("Producto no encontrado.");
      const categoryId = await this.categoryId(connection, dto.category);
      await connection.query(`UPDATE saas_eme_products SET category_id = ?, name = ?, price = ?, cost = COALESCE(?, cost) WHERE id = ?`, [
        categoryId,
        dto.name.trim(),
        dto.price,
        dto.cost === undefined ? null : Math.min(dto.cost, dto.price),
        id
      ]);
      await this.saveIngredients(connection, id, dto.ingredients);
      await this.bump(connection);
    });
    return this.fresh();
  }

  async deleteProduct(id: string): Promise<EmeStateResponse> {
    const result = await this.databaseService.execute<ResultSetHeader>(`UPDATE saas_eme_products SET active = 0 WHERE id = ? AND active = 1`, [id]);
    if (result.affectedRows === 0) throw new NotFoundException("Producto no encontrado.");
    await this.bump();
    return this.fresh();
  }

  async addCategory(dto: AddEmeCategoryDto): Promise<EmeStateResponse> {
    await this.databaseService.withTransaction(async (connection) => {
      await this.categoryId(connection, dto.name);
      await this.bump(connection);
    });
    return this.fresh();
  }
  // ---------------- Caja (19/11/2026) ----------------
  // Un turno de caja abierto a la vez. Se cierra a mano o solo a las 3 am de
  // Montevideo (06:00 UTC): el primer pedido de estado despues de esa hora lo
  // cierra y abre uno nuevo vacio.

  private businessDayStart(now = new Date()): string {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 6, 0, 0));
    if (now.getTime() < start.getTime()) start.setUTCDate(start.getUTCDate() - 1);
    return start.toISOString().slice(0, 19).replace("T", " ");
  }

  private async ensureRegister(): Promise<void> {
    const boundary = this.businessDayStart();
    const check = `SELECT id, opened_at < ? AS stale FROM saas_eme_register_sessions WHERE closed_at IS NULL ORDER BY id DESC LIMIT 1`;
    const rows = await this.databaseService.query<(RowDataPacket & { id: number; stale: number })[]>(check, [boundary]);
    if (rows[0] && !Number(rows[0].stale)) return;
    await this.databaseService.withTransaction(async (connection) => {
      const [open] = await connection.query<(RowDataPacket & { id: number; stale: number })[]>(check + " FOR UPDATE", [boundary]);
      if (open[0] && !Number(open[0].stale)) return;
      if (open[0]) {
        await connection.query(`UPDATE saas_eme_register_sessions SET closed_at = ?, closed_by = 'auto' WHERE closed_at IS NULL`, [boundary]);
      }
      await connection.query(`INSERT INTO saas_eme_register_sessions (opened_at, opening_amount) VALUES (?, 0)`, [boundary]);
      await this.bump(connection);
    });
  }

  private async currentRegisterId(): Promise<number> {
    await this.ensureRegister();
    const rows = await this.databaseService.query<(RowDataPacket & { id: number })[]>(
      `SELECT id FROM saas_eme_register_sessions WHERE closed_at IS NULL ORDER BY id DESC LIMIT 1`
    );
    if (!rows[0]) throw new BadRequestException("No hay caja abierta.");
    return rows[0].id;
  }

  private async registerState() {
    const sessions = await this.databaseService.query<(RowDataPacket & { id: number; opened_at: string; opening_amount: string; opening_set: number })[]>(
      `SELECT id, ${iso("opened_at")} AS opened_at, opening_amount, opening_set FROM saas_eme_register_sessions WHERE closed_at IS NULL ORDER BY id DESC LIMIT 1`
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

  async setOpening(amount: number): Promise<EmeStateResponse> {
    const id = await this.currentRegisterId();
    await this.databaseService.execute(`UPDATE saas_eme_register_sessions SET opening_amount = ?, opening_set = 1 WHERE id = ?`, [amount, id]);
    await this.bump();
    return this.fresh();
  }

  async addExpense(description: string, amount: number): Promise<EmeStateResponse> {
    const id = await this.currentRegisterId();
    await this.databaseService.execute(
      `INSERT INTO saas_eme_register_expenses (session_id, description, amount, created_at) VALUES (?, ?, ?, UTC_TIMESTAMP())`,
      [id, description.trim(), amount]
    );
    await this.bump();
    return this.fresh();
  }

  async deleteExpense(expenseId: number): Promise<EmeStateResponse> {
    const id = await this.currentRegisterId();
    const result = await this.databaseService.execute<ResultSetHeader>(`DELETE FROM saas_eme_register_expenses WHERE id = ? AND session_id = ?`, [expenseId, id]);
    if (result.affectedRows === 0) throw new NotFoundException("Gasto no encontrado.");
    await this.bump();
    return this.fresh();
  }

  // Cierre manual: cierra el turno y abre uno nuevo vacio desde ahora.
  async closeRegister(): Promise<EmeStateResponse> {
    await this.ensureRegister();
    await this.databaseService.withTransaction(async (connection) => {
      await connection.query(`UPDATE saas_eme_register_sessions SET closed_at = UTC_TIMESTAMP(), closed_by = 'manual' WHERE closed_at IS NULL`);
      await connection.query(`INSERT INTO saas_eme_register_sessions (opened_at, opening_amount) VALUES (UTC_TIMESTAMP(), 0)`);
      await this.bump(connection);
    });
    return this.fresh();
  }
}
