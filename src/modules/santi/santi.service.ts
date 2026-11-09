import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";

// Santi: demo de cobros, clientes, menu semanal e historial de pagos.
// Sin login (es una demo para mostrar). Los datos de ejemplo se cargan
// solos la primera vez y con POST /santi/reset.

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
const MAX_WEEK_OPTIONS = 3;

type SeedClient = {
  name: string;
  address: string;
  owes: number;
  menu: { name: string; items: string[]; note: string };
  weeklyMenu?: number;
  history: string[];
  payments: Array<{ date: string; amount: number; method: string }>;
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
    payments: [
      { date: "2026-10-28", amount: 1800, method: "Efectivo" },
      { date: "2026-10-21", amount: 1500, method: "Transferencia" }
    ]
  },
  {
    name: "María",
    address: "Bulevar Artigas 850",
    owes: 2300,
    menu: { name: "Menú vegetariano", items: ["Tarta de zapallitos", "Arroz con verduras", "Ensalada de rúcula", "Fruta de estación"], note: "Entregado 12:15" },
    history: ["Tarta de zapallitos", "Arroz con verduras", "Ensalada de rúcula y queso", "Ñoquis de calabaza", "Tortilla de espinaca"],
    payments: [
      { date: "2026-10-30", amount: 2300, method: "Transferencia" },
      { date: "2026-10-23", amount: 2300, method: "Transferencia" }
    ]
  },
  {
    name: "Ana",
    address: "Calle Colonia 455",
    owes: 1500,
    menu: { name: "Pasta del día", items: ["Ñoquis con salsa fileto", "Pan de campo", "Ensalada de tomate", "Budín de pan"], note: "Salsa aparte" },
    history: ["Ñoquis con fileto", "Ravioles de ricota", "Milanesa de pollo", "Tallarines con crema", "Pescado al horno"],
    payments: [{ date: "2026-10-29", amount: 1500, method: "Efectivo" }]
  },
  {
    name: "Pedro",
    address: "Avenida Italia 2210",
    owes: 800,
    menu: { name: "Menú liviano", items: ["Pollo al horno", "Puré de calabaza", "Gelatina"], note: "Porción chica" },
    history: ["Pollo al horno", "Puré de calabaza con carne", "Sopa de verduras", "Arroz con pollo", "Gelatina y fruta"],
    payments: [
      { date: "2026-10-27", amount: 800, method: "Efectivo" },
      { date: "2026-10-20", amount: 800, method: "Efectivo" }
    ]
  },
  {
    name: "Lucía",
    address: "Calle Soriano 612",
    owes: 3200,
    menu: { name: "Parrillada para dos", items: ["Asado y chorizo", "Ensalada rusa", "Boniato al horno", "Dulce de leche con queso"], note: "Entregado 13:00" },
    history: ["Parrillada para dos", "Milanesa napolitana", "Asado y chorizo", "Ravioles con crema", "Hamburguesa casera"],
    payments: [{ date: "2026-10-31", amount: 3200, method: "Transferencia" }]
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

function nowUtc() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

@Injectable()
export class SantiService {
  constructor(private readonly db: DatabaseService) {}

  async getState() {
    await this.ensureSeed();
    const [clients, menus, payments, history] = await Promise.all([
      this.db.query<ClientRow[]>(`SELECT * FROM saas_santi_clients ORDER BY id ASC`),
      this.db.query<MenuRow[]>(`SELECT * FROM saas_santi_menus ORDER BY id ASC`),
      this.db.query<PaymentRow[]>(
        `SELECT id, client_id, amount, method, DATE_FORMAT(paid_on, '%d/%m/%Y') AS date
         FROM saas_santi_payments ORDER BY paid_on DESC, id DESC`
      ),
      this.db.query<HistoryRow[]>(`SELECT client_id, day_name, dish FROM saas_santi_history ORDER BY id ASC`)
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
      history: history.map((row) => ({ clientId: row.client_id, day: row.day_name, dish: row.dish }))
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

  async setMenuInWeek(menuId: number, inWeek: boolean) {
    const menus = await this.db.query<MenuRow[]>(`SELECT * FROM saas_santi_menus WHERE id = ?`, [menuId]);
    if (!menus.length) throw new NotFoundException("Menú no encontrado.");

    if (inWeek) {
      const active = await this.db.query<(RowDataPacket & { total: number })[]>(
        `SELECT COUNT(*) AS total FROM saas_santi_menus WHERE in_week = 1 AND id <> ?`,
        [menuId]
      );
      if (Number(active[0]?.total ?? 0) >= MAX_WEEK_OPTIONS) {
        throw new BadRequestException("Ya hay 3 opciones esta semana. Quitá una primero.");
      }
    } else {
      // Si se quita una opcion, los clientes que la habian elegido quedan sin pedido.
      await this.db.execute(`UPDATE saas_santi_clients SET weekly_menu_id = NULL WHERE weekly_menu_id = ?`, [menuId]);
    }
    await this.db.execute(`UPDATE saas_santi_menus SET in_week = ? WHERE id = ?`, [inWeek ? 1 : 0, menuId]);
    return this.getState();
  }

  async reset() {
    for (const table of ["saas_santi_history", "saas_santi_payments", "saas_santi_clients", "saas_santi_menus"]) {
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
      const weeklyId = client.weeklyMenu ? menuIds[client.weeklyMenu - 1] : null;
      const result = await this.db.execute(
        `INSERT INTO saas_santi_clients
           (name, address, owes, today_menu_name, today_menu_items, today_menu_note, weekly_menu_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [client.name, client.address, client.owes, client.menu.name, JSON.stringify(client.menu.items), client.menu.note, weeklyId, nowUtc()]
      );
      const clientId = Number((result as unknown as { insertId: number }).insertId);
      await this.insertHistory(clientId, client.history);
      if (client.payments.length) {
        const placeholders = client.payments.map(() => "(?, ?, ?, ?, ?)").join(", ");
        const values = client.payments.flatMap((payment) => [clientId, payment.amount, payment.method, payment.date, nowUtc()]);
        await this.db.execute(
          `INSERT INTO saas_santi_payments (client_id, amount, method, paid_on, created_at) VALUES ${placeholders}`,
          values
        );
      }
    }
  }
}
