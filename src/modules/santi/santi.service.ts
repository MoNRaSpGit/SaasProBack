import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CreateSantiOrderDto } from "./dto/santi-order.dto";

// Santi: demo de cobros, clientes, menu semanal e historial de pagos.
// Sin login (es una demo para mostrar). Los datos de ejemplo se cargan
// solos la primera vez y con POST /santi/reset.

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
const MAX_WEEK_OPTIONS = 6;

// Precios de ejemplo (demo): vianda suelta y semana completa (5 dias).
const PRICE_DAY = 320;
const PRICE_WEEK = 1400;
// Hasta cuantos dias adelante se puede cargar un pedido.
const MAX_DAYS_AHEAD = 21;

type SeedClient = {
  name: string;
  address: string;
  owes: number;
  menu: { name: string; items: string[]; note: string };
  weeklyMenu?: number;
  history: string[];
  // ago = hace cuantos dias se pago (asi el panel siempre tiene datos de esta semana y este mes).
  payments: Array<{ ago: number; amount: number; method: string }>;
};

const SEED_MENUS: Array<{ name: string; items: string[]; inWeek: boolean }> = [
  { name: "Menú ravioli", items: ["Ravioles de ricota y espinaca", "Salsa fileto o crema", "Pan de campo", "Ensalada de tomate", "Flan casero"], inWeek: true },
  { name: "Menú milanesas", items: ["Milanesa de carne o pollo", "Papas fritas o puré", "Ensalada mixta", "Fruta de estación"], inWeek: true },
  { name: "Menú parrilla", items: ["Asado, chorizo y morcilla", "Ensalada rusa", "Boniato al horno", "Dulce de leche con queso"], inWeek: false },
  { name: "Menú liviano", items: ["Pollo al horno", "Verduras salteadas", "Arroz integral", "Gelatina"], inWeek: false },
  { name: "Menú pollo", items: ["Pollo a la cacerola", "Arroz con arvejas", "Ensalada de zanahoria", "Fruta de estación"], inWeek: true }
];

const SEED_CLIENTS: SeedClient[] = [
  {
    name: "Juan",
    address: "Avenida 18 de Julio 1234",
    owes: 1500,
    menu: { name: "Milanesa completa", items: ["Milanesa de carne con huevo", "Papas fritas", "Ensalada mixta", "Flan casero"], note: "Sin cebolla" },
    weeklyMenu: 1,
    history: ["Pollo al horno con papas", "Asado con ensalada", "Ravioles con salsa fileto", "Milanesa con puré", "Pizza de muzzarella"],
    payments: [{ ago: 2, amount: 1800, method: "Efectivo" }, { ago: 5, amount: 1500, method: "Transferencia" }, { ago: 9, amount: 1500, method: "Transferencia" }, { ago: 16, amount: 1800, method: "Efectivo" }]
  },
  {
    name: "María",
    address: "Bulevar Artigas 850",
    owes: 2300,
    menu: { name: "Menú vegetariano", items: ["Tarta de zapallitos", "Arroz con verduras", "Ensalada de rúcula", "Fruta de estación"], note: "Entregado 12:15" },
    history: ["Tarta de zapallitos", "Arroz con verduras", "Ensalada de rúcula y queso", "Ñoquis de calabaza", "Tortilla de espinaca"],
    payments: [{ ago: 0, amount: 2300, method: "Transferencia" }, { ago: 4, amount: 2300, method: "Transferencia" }, { ago: 11, amount: 2300, method: "Transferencia" }, { ago: 18, amount: 2300, method: "Transferencia" }]
  },
  {
    name: "Ana",
    address: "Calle Colonia 455",
    owes: 1500,
    menu: { name: "Pasta del día", items: ["Ñoquis con salsa fileto", "Pan de campo", "Ensalada de tomate", "Budín de pan"], note: "Salsa aparte" },
    history: ["Ñoquis con fileto", "Ravioles de ricota", "Milanesa de pollo", "Tallarines con crema", "Pescado al horno"],
    payments: [{ ago: 1, amount: 1500, method: "Efectivo" }, { ago: 3, amount: 1500, method: "Efectivo" }, { ago: 10, amount: 1500, method: "Efectivo" }, { ago: 17, amount: 1500, method: "Efectivo" }]
  },
  {
    name: "Pedro",
    address: "Avenida Italia 2210",
    owes: 800,
    menu: { name: "Menú liviano", items: ["Pollo al horno", "Puré de calabaza", "Gelatina"], note: "Porción chica" },
    history: ["Pollo al horno", "Puré de calabaza con carne", "Sopa de verduras", "Arroz con pollo", "Gelatina y fruta"],
    payments: [{ ago: 3, amount: 800, method: "Efectivo" }, { ago: 6, amount: 800, method: "Efectivo" }, { ago: 13, amount: 800, method: "Efectivo" }, { ago: 20, amount: 800, method: "Efectivo" }]
  },
  {
    name: "Lucía",
    address: "Calle Soriano 612",
    owes: 3200,
    menu: { name: "Parrillada para dos", items: ["Asado y chorizo", "Ensalada rusa", "Boniato al horno", "Dulce de leche con queso"], note: "Entregado 13:00" },
    history: ["Parrillada para dos", "Milanesa napolitana", "Asado y chorizo", "Ravioles con crema", "Hamburguesa casera"],
    payments: [{ ago: 4, amount: 3200, method: "Transferencia" }, { ago: 12, amount: 3200, method: "Transferencia" }, { ago: 19, amount: 3200, method: "Transferencia" }]
  }
];

type ClientRow = RowDataPacket & {
  id: number;
  name: string;
  address: string | null;
  owes: number;
  today_menu_name: string;
  today_menu_items: string;
  today_menu_note: string;
  weekly_menu_id: number | null;
};
type MenuRow = RowDataPacket & { id: number; name: string; items: string; in_week: number };
type OrderRow = RowDataPacket & {
  id: number;
  client_id: number;
  kind: string;
  qty: number;
  total: number;
  pay_status: string;
  note: string;
  date: string;
  menu_name: string;
};
type PaymentRow = RowDataPacket & { id: number; client_id: number; amount: number; method: string; date: string };
type HistoryRow = RowDataPacket & { client_id: number; day_name: string; dish: string };

function todayMontevideo() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Montevideo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function daysAgoMontevideo(days: number) {
  const base = new Date(`${todayMontevideo()}T12:00:00Z`);
  return new Date(base.getTime() - days * 86400000).toISOString().slice(0, 10);
}

function addDaysKey(dateKey: string, days: number) {
  return new Date(new Date(`${dateKey}T12:00:00Z`).getTime() + days * 86400000).toISOString().slice(0, 10);
}

function weekdayOfKey(dateKey: string) {
  return new Date(`${dateKey}T12:00:00Z`).getUTCDay();
}

function nowUtc() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

@Injectable()
export class SantiService {
  constructor(private readonly db: DatabaseService) {}

  async getState() {
    await this.ensureSeed();
    const [clients, menus, payments, history, orderRows] = await Promise.all([
      this.db.query<ClientRow[]>(`SELECT * FROM saas_santi_clients ORDER BY id ASC`),
      this.db.query<MenuRow[]>(`SELECT * FROM saas_santi_menus ORDER BY id ASC`),
      this.db.query<PaymentRow[]>(
        `SELECT id, client_id, amount, method, DATE_FORMAT(paid_on, '%d/%m/%Y') AS date
         FROM saas_santi_payments ORDER BY paid_on DESC, id DESC`
      ),
      this.db.query<HistoryRow[]>(`SELECT client_id, day_name, dish FROM saas_santi_history ORDER BY id ASC`),
      // Todos los pedidos, un renglon por dia de entrega.
      this.db.query<OrderRow[]>(
        `SELECT o.id, o.client_id, o.kind, o.qty, o.total, o.pay_status, o.note,
                DATE_FORMAT(d.delivery_date, '%Y-%m-%d') AS date, d.menu_name
         FROM saas_santi_order_days d JOIN saas_santi_orders o ON o.id = d.order_id
         ORDER BY d.delivery_date ASC, o.id ASC`
      )
    ]);

    return {
      clients: clients.map((row) => ({
        id: row.id,
        name: row.name,
        address: row.address || "",
        owes: row.owes,
        menu: { name: row.today_menu_name, items: JSON.parse(row.today_menu_items) as string[], note: row.today_menu_note },
        weeklyMenuId: row.weekly_menu_id
      })),
      menus: menus.map((row) => ({
        id: row.id,
        name: row.name,
        items: JSON.parse(row.items) as string[],
        inWeek: Boolean(row.in_week)
      })),
      payments: payments.map((row) => ({
        id: row.id,
        clientId: row.client_id,
        amount: row.amount,
        method: row.method,
        date: row.date
      })),
      history: history.map((row) => ({ clientId: row.client_id, day: row.day_name, dish: row.dish })),
      today: todayMontevideo(),
      prices: await this.getPrices(),
      orders: orderRows.map((row) => ({
        orderId: row.id,
        clientId: row.client_id,
        kind: row.kind,
        qty: row.qty,
        total: row.total,
        payStatus: row.pay_status,
        note: row.note,
        date: row.date,
        menuName: row.menu_name
      }))
    };
  }

  async createClient(name?: string, address?: string) {
    const cleanName = (name || "").trim();
    const cleanAddress = (address || "").trim();
    if (!cleanName && !cleanAddress) {
      throw new BadRequestException("Poné al menos el nombre o la calle.");
    }
    const finalName = cleanName || cleanAddress;
    const result = await this.db.execute<ResultSetHeader>(
      `INSERT INTO saas_santi_clients
         (name, address, owes, today_menu_name, today_menu_items, today_menu_note, created_at)
       VALUES (?, ?, 0, ?, ?, ?, ?)`,
      [finalName, cleanAddress || null, "Todavía sin menú hoy", "[]", "No se le mandó nada hoy", nowUtc()]
    );
    const clientId = Number((result as unknown as { insertId: number }).insertId);
    await this.insertHistory(clientId, DAYS.map(() => "Sin pedido"));
    return this.getState();
  }

  async registerPayment(clientId: number) {
    const client = await this.getClientOrThrow(clientId);
    if (client.owes > 0) {
      await this.db.execute(
        `INSERT INTO saas_santi_payments (client_id, amount, method, paid_on, created_at) VALUES (?, ?, ?, ?, ?)`,
        [clientId, client.owes, "Efectivo", todayMontevideo(), nowUtc()]
      );
      await this.db.execute(`UPDATE saas_santi_clients SET owes = 0 WHERE id = ?`, [clientId]);
      await this.db.execute(`UPDATE saas_santi_orders SET pay_status = 'pagado', paid_amount = total WHERE client_id = ?`, [clientId]);
    }
    return this.getState();
  }

  async setWeekly(clientId: number, menuId: number | null | undefined) {
    await this.getClientOrThrow(clientId);
    if (menuId == null) {
      await this.db.execute(`UPDATE saas_santi_clients SET weekly_menu_id = NULL WHERE id = ?`, [clientId]);
      return this.getState();
    }
    const menus = await this.db.query<MenuRow[]>(`SELECT * FROM saas_santi_menus WHERE id = ?`, [menuId]);
    if (!menus.length || !menus[0].in_week) {
      throw new BadRequestException("Ese menú no es una de las opciones de esta semana.");
    }
    await this.db.execute(`UPDATE saas_santi_clients SET weekly_menu_id = ? WHERE id = ?`, [menuId, clientId]);
    return this.getState();
  }

  async setHistory(clientId: number, day: string, dish: string) {
    await this.getClientOrThrow(clientId);
    if (!DAYS.includes(day)) {
      throw new BadRequestException("Día inválido.");
    }
    const cleanDish = dish.trim();
    if (!cleanDish) {
      throw new BadRequestException("Elegí un menú.");
    }
    await this.db.execute(
      `INSERT INTO saas_santi_history (client_id, day_name, dish) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE dish = VALUES(dish)`,
      [clientId, day, cleanDish]
    );
    return this.getState();
  }

  // Registrar pedido: guarda el pedido y sus dias, lo anota en el historial
  // de la semana en curso, y lo que no se pago se suma a lo que debe.
  async createOrder(dto: CreateSantiOrderDto) {
    await this.getClientOrThrow(dto.clientId);

    const today = todayMontevideo();
    const lastAllowed = addDaysKey(today, MAX_DAYS_AHEAD);
    const dates = new Set<string>();
    for (const day of dto.days) {
      const weekday = weekdayOfKey(day.date);
      if (day.date < today || day.date > lastAllowed || weekday < 1 || weekday > 5) {
        throw new BadRequestException("Los pedidos son de lunes a viernes, desde hoy y hasta 3 semanas adelante.");
      }
      if (dates.has(day.date)) throw new BadRequestException("Hay un día repetido en el pedido.");
      dates.add(day.date);
    }

    const menus = await this.db.query<MenuRow[]>(`SELECT * FROM saas_santi_menus`);
    const menuById = new Map(menus.map((menu) => [menu.id, menu]));
    if (dto.days.some((day) => !menuById.has(day.menuId))) throw new BadRequestException("Elegí un menú para cada día.");

    const paid = dto.payStatus === "pagado" ? dto.total : dto.payStatus === "sena" ? Number(dto.paidAmount ?? 0) : 0;
    if (dto.payStatus === "sena" && (paid <= 0 || paid >= dto.total)) {
      throw new BadRequestException("La seña tiene que ser mayor que 0 y menor que el total.");
    }
    const debt = dto.total - paid;
    const note = (dto.note || "").trim();

    await this.db.withTransaction(async (connection) => {
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO saas_santi_orders (client_id, kind, qty, total, pay_status, paid_amount, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [dto.clientId, dto.kind, dto.qty, dto.total, dto.payStatus, paid, note, nowUtc()]
      );
      for (const day of dto.days) {
        await connection.execute(`INSERT INTO saas_santi_order_days (order_id, delivery_date, menu_id, menu_name) VALUES (?, ?, ?, ?)`, [
          result.insertId,
          day.date,
          day.menuId,
          menuById.get(day.menuId)!.name
        ]);
      }
      if (paid > 0) {
        await connection.execute(`INSERT INTO saas_santi_payments (client_id, amount, method, paid_on, created_at) VALUES (?, ?, ?, ?, ?)`, [
          dto.clientId,
          paid,
          "Efectivo",
          today,
          nowUtc()
        ]);
      }
      if (debt > 0) {
        await connection.execute(`UPDATE saas_santi_clients SET owes = owes + ? WHERE id = ?`, [debt, dto.clientId]);
      }
      // Historial "Lunes a Viernes": solo los dias de ESTA semana.
      const monday = addDaysKey(today, -((weekdayOfKey(today) + 6) % 7));
      const sunday = addDaysKey(monday, 6);
      for (const day of dto.days) {
        if (day.date < monday || day.date > sunday) continue;
        await connection.execute(
          `INSERT INTO saas_santi_history (client_id, day_name, dish) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE dish = VALUES(dish)`,
          [dto.clientId, DAYS[weekdayOfKey(day.date) - 1], menuById.get(day.menuId)!.name]
        );
      }
      // Semanal con una opcion de la semana: queda como "menu de toda la semana".
      const first = menuById.get(dto.days[0].menuId)!;
      if (dto.kind === "semanal" && first.in_week && dto.days.some((day) => day.date >= today && day.date <= sunday)) {
        await connection.execute(`UPDATE saas_santi_clients SET weekly_menu_id = ? WHERE id = ?`, [first.id, dto.clientId]);
      }
    });

    return this.getState();
  }

  async saveSettings(priceDay: number, priceWeek: number) {
    await this.db.execute(
      `INSERT INTO saas_santi_settings (id, price_day, price_week) VALUES (1, ?, ?)
       ON DUPLICATE KEY UPDATE price_day = VALUES(price_day), price_week = VALUES(price_week)`,
      [priceDay, priceWeek]
    );
    return this.getState();
  }

  private async getPrices() {
    const rows = await this.db.query<(RowDataPacket & { price_day: number; price_week: number })[]>(
      `SELECT price_day, price_week FROM saas_santi_settings WHERE id = 1`
    );
    return { day: rows[0]?.price_day ?? PRICE_DAY, week: rows[0]?.price_week ?? PRICE_WEEK };
  }

  // Plato nuevo (ej. "Caruso"): entra directo a la semana si hay lugar.
  async createMenu(name: string) {
    const cleanName = name.replace(/\s+/g, " ").trim();
    if (cleanName.length < 2) throw new BadRequestException("Poné el nombre del plato.");
    const existing = await this.db.query<MenuRow[]>(`SELECT * FROM saas_santi_menus WHERE LOWER(name) = LOWER(?)`, [cleanName]);
    if (existing.length) throw new BadRequestException("Ese plato ya está en la lista.");
    const active = await this.db.query<(RowDataPacket & { total: number })[]>(`SELECT COUNT(*) AS total FROM saas_santi_menus WHERE in_week = 1`);
    const inWeek = Number(active[0]?.total ?? 0) < MAX_WEEK_OPTIONS ? 1 : 0;
    await this.db.execute(`INSERT INTO saas_santi_menus (name, items, in_week) VALUES (?, '[]', ?)`, [cleanName, inWeek]);
    return this.getState();
  }

  async setMenuInWeek(menuId: number, inWeek: boolean) {
    const menus = await this.db.query<MenuRow[]>(`SELECT * FROM saas_santi_menus WHERE id = ?`, [menuId]);
    if (!menus.length) throw new NotFoundException("Menú no encontrado.");

    if (inWeek) {
      const active = await this.db.query<(RowDataPacket & { total: number })[]>(
        `SELECT COUNT(*) AS total FROM saas_santi_menus WHERE in_week = 1 AND id <> ?`,
        [menuId]
      );
      if (Number(active[0]?.total ?? 0) >= MAX_WEEK_OPTIONS) {
        throw new BadRequestException(`Ya hay ${MAX_WEEK_OPTIONS} platos esta semana. Quitá uno primero.`);
      }
    } else {
      // Si se quita una opcion, los clientes que la habian elegido quedan sin pedido.
      await this.db.execute(`UPDATE saas_santi_clients SET weekly_menu_id = NULL WHERE weekly_menu_id = ?`, [menuId]);
    }
    await this.db.execute(`UPDATE saas_santi_menus SET in_week = ? WHERE id = ?`, [inWeek ? 1 : 0, menuId]);
    return this.getState();
  }

  async reset() {
    for (const table of ["saas_santi_order_days", "saas_santi_orders", "saas_santi_history", "saas_santi_payments", "saas_santi_clients", "saas_santi_menus"]) {
      await this.db.execute(`DELETE FROM ${table}`);
    }
    await this.seed();
    return this.getState();
  }

  // ---------------- internos ----------------

  // Un solo INSERT con los 5 dias (menos viajes a la base).
  private async insertHistory(clientId: number, dishes: string[]) {
    const placeholders = DAYS.map(() => "(?, ?, ?)").join(", ");
    const values = DAYS.flatMap((day, i) => [clientId, day, dishes[i]]);
    await this.db.execute(`INSERT INTO saas_santi_history (client_id, day_name, dish) VALUES ${placeholders}`, values);
  }

  private async getClientOrThrow(clientId: number) {
    const rows = await this.db.query<ClientRow[]>(`SELECT * FROM saas_santi_clients WHERE id = ?`, [clientId]);
    if (!rows.length) throw new NotFoundException("Cliente no encontrado.");
    return rows[0];
  }

  private async ensureSeed() {
    const rows = await this.db.query<(RowDataPacket & { total: number })[]>(
      `SELECT (SELECT COUNT(*) FROM saas_santi_clients) + (SELECT COUNT(*) FROM saas_santi_menus) AS total`
    );
    if (Number(rows[0]?.total ?? 0) === 0) {
      await this.seed();
    }
  }

  private async seed() {
    const menuIds: number[] = [];
    for (const menu of SEED_MENUS) {
      const result = await this.db.execute(`INSERT INTO saas_santi_menus (name, items, in_week) VALUES (?, ?, ?)`, [
        menu.name,
        JSON.stringify(menu.items),
        menu.inWeek ? 1 : 0
      ]);
      menuIds.push(Number((result as unknown as { insertId: number }).insertId));
    }

    for (const client of SEED_CLIENTS) {
      const result = await this.db.execute(
        `INSERT INTO saas_santi_clients
           (name, address, owes, today_menu_name, today_menu_items, today_menu_note, weekly_menu_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [client.name, client.address, 0, "Todavía sin menú hoy", "[]", "", null, nowUtc()]
      );
      const clientId = Number((result as unknown as { insertId: number }).insertId);
      await this.insertHistory(clientId, DAYS.map(() => "Sin pedido"));
    }
  }
}
