import { Injectable } from "@nestjs/common";
import { RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { dayRangeUtc, epochRangeMs, extractEpoch, formatMontevideoTime } from "./movimientos.dateUtils";

// clients: sub-tarjetas por cliente (hoy solo Gym, 23/10/2026: "entro a
// Gym y me sale Ale Gym y Pablo M").
export type MovimientosClientSummary = { key: string; label: string; count: number };
export type MovimientosAppSummary = { key: string; label: string; count: number; clients?: MovimientosClientSummary[]; visitsToday?: number };
export type MovimientosDetailItem = { time: string; label: string; detail: string };

// Gym: cada workspace es un cliente (gimnasio). Los de demo y el
// "public" (pruebas internas) van juntos en "Otros".
export const GYM_OTHERS_KEY = "otros";
function isRealGymWorkspace(workspaceKey: string) {
  return workspaceKey !== "public" && !workspaceKey.startsWith("demo");
}
// Nombre lindo para los clientes que ya conocemos; el resto usa el nombre
// del usuario del gym (o la clave del workspace).
const GYM_CLIENT_LABELS: Record<string, string> = { alegym: "Ale Gym", pablom: "Pablo M" };

// Cuentas de Agro (usuario del login propio -> nombre en Movimientos).
const AGRO_CLIENT_LABELS: Record<string, string> = { rosendo: "Rosendo", administrador: "Contador" };

// Unico cliente real de frontend-agro hoy (ver memoria del proyecto).
const AGRO_TENANT_ID = 123;

const GYM_ACTION_LABELS: Record<string, string> = {
  login: "Inicio de sesión",
  login_failed: "Intento fallido",
  student_created: "Alta de alumno",
  student_renewed: "Renovación",
  student_updated: "Edición de alumno",
  student_deleted: "Borrado de alumno",
  student_checkin: "Ingreso",
  expense_created: "Alta de gasto",
  expense_paid: "Gasto pagado",
  expense_deleted: "Borrado de gasto",
  task_created: "Alta de tarea",
  task_moved: "Tarea movida",
  task_deleted: "Borrado de tarea",
  movement_created: "Movimiento cargado",
  movement_deleted: "Movimiento borrado",
  progress_created: "Medición cargada",
  progress_deleted: "Medición borrada"
};

const AGRO_KIND_LABELS: Record<string, string> = {
  purchase: "Compra",
  sale: "Venta",
  transfer_out: "Traslado (salida)",
  transfer_in: "Traslado (entrada)",
  transfer_internal: "Traslado interno",
  birth: "Nacimiento",
  death: "Muerte",
  shortage: "Faltante",
  correction_in: "Corrección +",
  correction_out: "Corrección -"
};

type AuditRow = RowDataPacket & {
  when_raw: string;
  action: string;
  entity_type?: string;
  entity_id?: string | number;
  entity_label?: string;
  summary?: string;
  details?: string;
  actor?: string;
  actor_email?: string;
};

// Cada tabla de auditoria de este monorepo tiene sus propias columnas (no
// todas tienen entity_type/entity_label/summary/actor) -- ver los distintos
// scripts/inspect-*-audit.js, que son la fuente de verdad de cada esquema.
const SQL_AUDIT_TABLES: Record<
  "piloto" | "gaby" | "eme" | "distribuidora" | "qq" | "ropa" | "juez",
  { table: string; timeCol: string; columns: string; actionLabels?: Record<string, string>; buildDetail: (row: AuditRow, service: MovimientosService) => string }
> = {
  piloto: {
    table: "saas_piloto_audit_log",
    timeCol: "occurred_at",
    columns: "action, entity_type, entity_id, entity_label, details",
    actionLabels: {
      create: "Alta",
      update: "Edición",
      sale: "Venta"
    },
    buildDetail: (row, service) =>
      row.entity_label || service.summarizeJsonDetails(row.details) || `${row.entity_type || ""} #${row.entity_id ?? ""}`
  },
  // Gaby Almacen (07/11/2026): misma tabla de auditoria que Piloto.
  gaby: {
    table: "saas_gaby_audit_log",
    timeCol: "occurred_at",
    columns: "action, entity_type, entity_id, entity_label, details",
    actionLabels: {
      create: "Alta",
      update: "Edición",
      sale: "Venta"
    },
    buildDetail: (row, service) =>
      row.entity_label || service.summarizeJsonDetails(row.details) || `${row.entity_type || ""} #${row.entity_id ?? ""}`
  },
  // Eme (12/11/2026): demo de pizzeria, sin login. Cada fila es algo que hizo
  // un navegador (visitor_id); los "yo-" son dispositivos NUESTROS.
  eme: {
    table: "saas_eme_activity_log",
    timeCol: "occurred_at",
    columns: "event AS action, detail AS summary, visitor_id AS actor",
    actionLabels: {
      entrada: "Entró a la app",
      login: "Ingreso",
      logout: "Salió",
      seccion: "Abrió pestaña",
      accion: "Acción"
    },
    buildDetail: (row) => `${String(row.actor || "").startsWith("yo-") ? "[Nosotros] " : ""}${row.summary || ""}`.trim()
  },
  distribuidora: {
    table: "saas_distribuidora_audit_log",
    timeCol: "occurred_at",
    columns: "action, entity_id, summary",
    actionLabels: {
      order_create: "Alta de pedido",
      order_update: "Edición de pedido",
      order_delete: "Borrado de pedido",
      order_invoice: "Facturación",
      product_create: "Alta de producto",
      product_update: "Edición de producto",
      client_create: "Alta de cliente",
      client_update: "Edición de cliente"
    },
    buildDetail: (row) => row.summary || `#${row.entity_id ?? ""}`
  },
  qq: {
    table: "saas_qq_audit_log",
    timeCol: "occurred_at",
    columns: "action, entity_type, entity_id, entity_label, actor_email, actor_role, details",
    // visit/view_product/add_to_cart/open_cart/whatsapp_click son de
    // visitantes anonimos del catalogo (ver qq-audit.service.ts) -- nunca
    // se les pone nombre real, y el detalle nunca cae en "visitor #<id
    // al azar>" (pedido explicito 01/11/2026: nada que parezca un dato
    // tecnico del visitante, como una IP).
    actionLabels: {
      create: "Alta de producto",
      update: "Edición de producto",
      delete: "Borrado de producto",
      reorder: "Reorden",
      upload_image: "Foto subida",
      register: "Registro de cliente",
      login: "Inicio de sesión",
      login_failed: "Intento fallido",
      checkout_whatsapp: "Compra por WhatsApp",
      visit: "Visitante · entró",
      view_product: "Visitante · abrió un producto",
      add_to_cart: "Visitante · agregó al carrito",
      open_cart: "Visitante · abrió el carrito",
      whatsapp_click: "Visitante · fue a WhatsApp"
    },
    buildDetail: (row, service) => {
      if (row.entity_type === "visitor") return row.entity_label || "";
      return (
        row.entity_label ||
        service.summarizeJsonDetails(row.details) ||
        row.actor_email ||
        `${row.entity_type || ""} #${row.entity_id ?? ""}`
      );
    }
  },
  // Ropa (16/11/2026): clon de QQ, misma tabla de auditoria y mismas acciones.
  ropa: {
    table: "saas_ropa_audit_log",
    timeCol: "occurred_at",
    columns: "action, entity_type, entity_id, entity_label, actor_email, actor_role, details",
    actionLabels: {
      create: "Alta",
      update: "Edición",
      delete: "Borrado",
      reorder: "Reorden",
      upload_image: "Foto subida",
      register: "Registro de cliente",
      login: "Inicio de sesión",
      login_failed: "Intento fallido",
      checkout_whatsapp: "Compra por WhatsApp",
      visit: "Visitante · entró",
      view_product: "Visitante · abrió un producto",
      add_to_cart: "Visitante · agregó al carrito",
      open_cart: "Visitante · abrió el carrito",
      whatsapp_click: "Visitante · fue a WhatsApp"
    },
    buildDetail: (row, service) => {
      if (row.entity_type === "visitor") return row.entity_label || "";
      return (
        row.entity_label ||
        service.summarizeJsonDetails(row.details) ||
        row.actor_email ||
        `${row.entity_type || ""} #${row.entity_id ?? ""}`
      );
    }
  },
  juez: {
    table: "saas_juez_audit_log",
    timeCol: "created_at",
    columns: "action, actor, details",
    actionLabels: {
      login: "LOGIN",
      login_blocked: "Intento de login admin",
      player_created: "Alta jugador",
      player_updated: "Edición jugador",
      team_created: "Alta equipo"
    },
    // login/login_blocked guardan texto plano en "details" (no JSON) --
    // summarizeJsonDetails no puede parsearlo y devuelve "", asi que se
    // usa ese texto tal cual antes de caer al actor.
    buildDetail: (row, service) =>
      service.summarizeJsonDetails(row.details) ||
      (typeof row.details === "string" && row.details.trim() ? row.details : row.actor || "")
  }
};

@Injectable()
export class MovimientosService {
  constructor(private readonly databaseService: DatabaseService) {}

  // dayLabel (YYYY-MM-DD, Montevideo): dia a resumir; sin el, hoy.
  async getSummary(dayLabel?: string): Promise<MovimientosAppSummary[]> {
    const [piloto, gaby, eme, gym, agro, distribuidora, qq, juez, camiones, qqVisits, ropa, ropaVisits] = await Promise.all([
      this.countSqlAudit("piloto", dayLabel),
      this.countSqlAudit("gaby", dayLabel),
      this.countSqlAudit("eme", dayLabel),
      this.countGymByClient(dayLabel),
      this.countAgroByClient(dayLabel),
      this.countSqlAudit("distribuidora", dayLabel),
      this.countSqlAudit("qq", dayLabel),
      this.countSqlAudit("juez", dayLabel),
      this.countCamiones(dayLabel),
      this.countVisits("saas_qq_audit_log", dayLabel),
      this.countSqlAudit("ropa", dayLabel),
      this.countVisits("saas_ropa_audit_log", dayLabel)
    ]);

    return [
      { key: "gym", label: "Gym", count: gym.reduce((total, client) => total + client.count, 0), clients: gym },
      { key: "piloto", label: "Piloto", count: piloto },
      { key: "gaby", label: "Gaby", count: gaby },
      { key: "eme", label: "Eme", count: eme },
      { key: "agro", label: "Agro", count: agro.reduce((total, client) => total + client.count, 0), clients: agro },
      { key: "distribuidora", label: "Distribuidora", count: distribuidora },
      { key: "qq", label: "QQ", count: qq, visitsToday: qqVisits },
      { key: "ropa", label: "Ropa", count: ropa, visitsToday: ropaVisits },
      { key: "juez", label: "Juez", count: juez },
      { key: "camiones", label: "Camiones", count: camiones }
    ];
  }

  async getDetail(appKey: string, dayLabel?: string, client?: string): Promise<MovimientosDetailItem[]> {
    switch (appKey) {
      case "gym":
        return this.detailGym(dayLabel, client);
      case "agro":
        return this.detailAgro(dayLabel, client);
      case "camiones":
        return this.detailCamiones(dayLabel);
      case "piloto":
      case "gaby":
      case "eme":
      case "distribuidora":
      case "qq":
      case "ropa":
      case "juez":
        return this.detailSqlAudit(appKey, dayLabel);
      default:
        return [];
    }
  }

  // Visitas de hoy al catalogo de QQ (13/11/2026, pedido explicito: "hoy
  // hubo 20 visitas"). Cada entrada al catalogo guarda un "visit" con un id
  // al azar que no se guarda en el telefono, asi que cada visita = un visitante.
  // (16/11/2026) Generalizado para QQ y Ropa; la tabla viene SIEMPRE de este
  // archivo (nunca del request).
  private async countVisits(table: "saas_qq_audit_log" | "saas_ropa_audit_log", dayLabel?: string) {
    const { start, end } = dayRangeUtc(dayLabel);
    const rows = await this.databaseService.query<(RowDataPacket & { total: number })[]>(
      `SELECT COUNT(*) AS total FROM ${table} WHERE action = 'visit' AND occurred_at >= ? AND occurred_at < ?`,
      [start, end]
    );
    return Number(rows[0]?.total ?? 0);
  }

  // ---------------- Camiones (15/11/2026, pedido explicito: reemplaza a GPS):
  // no tiene tabla de auditoria propia, se arma con las fechas reales de cada
  // viaje: ingresado (created_at), finalizado por el camionero
  // (driver_done_at), pagado al camionero (driver_paid_at) y cobrado al
  // cliente (paid_at). ----

  private async countCamiones(dayLabel?: string) {
    const { start, end } = dayRangeUtc(dayLabel);
    const rows = await this.databaseService.query<(RowDataPacket & { total: number })[]>(
      `SELECT
         (SELECT COUNT(*) FROM saas_camiones_trips WHERE created_at >= ? AND created_at < ?) +
         (SELECT COUNT(*) FROM saas_camiones_trips WHERE driver_done_at >= ? AND driver_done_at < ?) +
         (SELECT COUNT(*) FROM saas_camiones_trips WHERE driver_paid_at >= ? AND driver_paid_at < ?) +
         (SELECT COUNT(*) FROM saas_camiones_trips WHERE paid_at >= ? AND paid_at < ?) AS total`,
      [start, end, start, end, start, end, start, end]
    );
    return Number(rows[0]?.total ?? 0);
  }

  private async detailCamiones(dayLabel?: string): Promise<MovimientosDetailItem[]> {
    const { start, end } = dayRangeUtc(dayLabel);
    type TripEventRow = RowDataPacket & {
      when_raw: string;
      client_name: string;
      place: string;
      notes: string | null;
      kilometers: string;
      by_name: string | null;
      driver_name: string | null;
    };
    const fetchEvents = (column: string) =>
      this.databaseService.query<TripEventRow[]>(
        `SELECT DATE_FORMAT(t.${column}, '%Y-%m-%dT%H:%i:%s') AS when_raw, c.name AS client_name, t.place, t.notes, t.kilometers,
                COALESCE(u.full_name, u.username) AS by_name, COALESCE(u.full_name, u.username) AS driver_name
         FROM saas_camiones_trips t
         INNER JOIN saas_camiones_clients c ON c.id = t.client_id
         LEFT JOIN saas_camiones_users u ON u.id = t.user_id
         WHERE t.${column} >= ? AND t.${column} < ?
         ORDER BY t.${column} DESC`,
        [start, end]
      );

    const [created, done, driverPaid, clientPaid] = await Promise.all([
      fetchEvents("created_at"),
      fetchEvents("driver_done_at"),
      fetchEvents("driver_paid_at"),
      fetchEvents("paid_at")
    ]);

    const noteValue = (notes: string | null, prefix: string) =>
      (notes ?? "").split("||").map((token) => token.trim()).find((token) => token.startsWith(prefix))?.slice(prefix.length).trim() ?? "";
    const route = (row: TripEventRow) => `${noteValue(row.notes, "route-from::") || "?"} → ${row.place}`;
    const money = (value: number) => `$${Math.round(value)}`;
    const items: Array<MovimientosDetailItem & { t: string }> = [];

    for (const row of created) {
      items.push({ time: formatMontevideoTime(row.when_raw), label: "Viaje ingresado", detail: `${row.by_name || "?"} · ${row.client_name} · ${route(row)}`, t: row.when_raw });
    }
    for (const row of done) {
      items.push({ time: formatMontevideoTime(row.when_raw), label: "Viaje finalizado", detail: `${row.driver_name || "?"} · ${row.client_name} · ${route(row)}`, t: row.when_raw });
    }
    for (const row of driverPaid) {
      const total = Number(noteValue(row.notes, "trip-total::"));
      const share = Number.isFinite(total) && total > 0 ? ` · le tocaron ${money(total * 0.1)}` : "";
      items.push({ time: formatMontevideoTime(row.when_raw), label: "Viaje pagado al camionero", detail: `${row.driver_name || "?"} · ${row.client_name} · ${route(row)}${share}`, t: row.when_raw });
    }
    for (const row of clientPaid) {
      items.push({ time: formatMontevideoTime(row.when_raw), label: "Viaje cobrado al cliente", detail: `${row.client_name} · ${route(row)}`, t: row.when_raw });
    }

    return items.sort((x, y) => y.t.localeCompare(x.t)).map(({ time, label, detail }) => ({ time, label, detail }));
  }

  // ---------------- Piloto / Distribuidora / QQ / Juez: misma tabla de
  // auditoria SQL en los 4 casos, mismo rango de "hoy" en Montevideo. ----

  private async countSqlAudit(appKey: keyof typeof SQL_AUDIT_TABLES, dayLabel?: string) {
    const { table, timeCol } = SQL_AUDIT_TABLES[appKey];
    const { start, end } = dayRangeUtc(dayLabel);
    const rows = await this.databaseService.query<(RowDataPacket & { total: number })[]>(
      `SELECT COUNT(*) AS total FROM ${table} WHERE ${timeCol} >= ? AND ${timeCol} < ?`,
      [start, end]
    );
    return Number(rows[0]?.total ?? 0);
  }

  private async detailSqlAudit(appKey: keyof typeof SQL_AUDIT_TABLES, dayLabel?: string): Promise<MovimientosDetailItem[]> {
    const { table, timeCol, columns, actionLabels, buildDetail } = SQL_AUDIT_TABLES[appKey];
    const { start, end } = dayRangeUtc(dayLabel);
    const rows = await this.databaseService.query<AuditRow[]>(
      `SELECT DATE_FORMAT(${timeCol}, '%Y-%m-%dT%H:%i:%s') AS when_raw, ${columns}
       FROM ${table}
       WHERE ${timeCol} >= ? AND ${timeCol} < ?
       ORDER BY ${timeCol} DESC`,
      [start, end]
    );

    return rows.map((row) => {
      const label = (actionLabels && actionLabels[row.action]) || String(row.action || "").toUpperCase();
      return { time: formatMontevideoTime(row.when_raw), label, detail: String(buildDetail(row, this) || "") };
    });
  }

  summarizeJsonDetails(raw: unknown): string {
    if (!raw || typeof raw !== "string") return "";
    try {
      const parsed = JSON.parse(raw);
      if (parsed.changes) {
        return Object.entries(parsed.changes as Record<string, [unknown, unknown]>)
          .map(([field, [from, to]]) => `${field}: ${from ?? "(vacío)"} -> ${to ?? "(vacío)"}`)
          .join("; ");
      }
      if (Array.isArray(parsed.items)) {
        return `${parsed.paymentMethod ?? ""} total $${parsed.totalAmount ?? ""} (${parsed.itemsCount ?? parsed.items.length} items)`;
      }
      return "";
    } catch {
      return "";
    }
  }

  // ---------------- Gym: todos los workspaces, auditLog embebido en el JSON. ----

  private async loadGymWorkspaces() {
    return this.databaseService.query<(RowDataPacket & { workspace_key: string; workspace_json: unknown })[]>(
      `SELECT workspace_key, workspace_json FROM saas_gym_workspaces`
    );
  }

  // Movimientos de hoy por cliente (workspace): los reales cada uno con su
  // tarjeta, los de demo/pruebas juntos en "Otros" (solo si hay alguno).
  private async countGymByClient(dayLabel?: string): Promise<MovimientosClientSummary[]> {
    const [rows, users] = await Promise.all([
      this.loadGymWorkspaces(),
      this.databaseService.query<(RowDataPacket & { workspace_key: string; full_name: string | null })[]>(
        `SELECT workspace_key, MIN(full_name) AS full_name FROM saas_gym_users GROUP BY workspace_key`
      )
    ]);
    const nameByWorkspace = new Map(users.map((user) => [user.workspace_key, user.full_name]));
    const { startMs, endMs } = epochRangeMs(dayLabel);
    const clients: MovimientosClientSummary[] = [];
    let othersCount = 0;
    let hasOthers = false;
    for (const row of rows) {
      const data = this.parseJson(row.workspace_json);
      const auditLog = Array.isArray(data?.auditLog) ? data.auditLog : [];
      const count = auditLog.filter((entry: { timestamp?: string }) => {
        if (!entry.timestamp) return false;
        const t = new Date(entry.timestamp).getTime();
        return t >= startMs && t < endMs;
      }).length;
      if (isRealGymWorkspace(row.workspace_key)) {
        const label = GYM_CLIENT_LABELS[row.workspace_key] || nameByWorkspace.get(row.workspace_key) || row.workspace_key;
        clients.push({ key: row.workspace_key, label, count });
      } else {
        othersCount += count;
        hasOthers = true;
      }
    }
    clients.sort((a, b) => a.label.localeCompare(b.label, "es"));
    if (hasOthers) clients.push({ key: GYM_OTHERS_KEY, label: "Otros (demos y pruebas)", count: othersCount });
    return clients;
  }

  // client = workspace del gimnasio, "otros" = demos/pruebas, sin client =
  // todos juntos (como antes).
  private async detailGym(dayLabel?: string, client?: string): Promise<MovimientosDetailItem[]> {
    const allRows = await this.loadGymWorkspaces();
    const rows = !client
      ? allRows
      : client === GYM_OTHERS_KEY
        ? allRows.filter((row) => !isRealGymWorkspace(row.workspace_key))
        : allRows.filter((row) => row.workspace_key === client);
    const { startMs, endMs } = epochRangeMs(dayLabel);
    // Se ordena por la hora real (t): ordenar el texto "08:21 p. m." vs
    // "12:07 a. m." dejaba los de la noche abajo de los de la madrugada.
    const items: Array<MovimientosDetailItem & { t: number }> = [];

    for (const row of rows) {
      const data = this.parseJson(row.workspace_json);
      const auditLog = Array.isArray(data?.auditLog) ? data.auditLog : [];
      for (const entry of auditLog as { timestamp?: string; action?: string; details?: string }[]) {
        if (!entry.timestamp) continue;
        const t = new Date(entry.timestamp).getTime();
        if (t < startMs || t >= endMs) continue;
        items.push({
          time: new Date(entry.timestamp).toLocaleTimeString("es-UY", { timeZone: "America/Montevideo", hour: "2-digit", minute: "2-digit" }),
          // Con un solo gimnasio elegido no hace falta repetir de cual es.
          label: `${GYM_ACTION_LABELS[entry.action || ""] || entry.action || "Movimiento"}${client && client !== GYM_OTHERS_KEY ? "" : ` (${row.workspace_key})`}`,
          detail: entry.details || "",
          t
        });
      }
    }

    return items.sort((a, b) => b.t - a.t).map(({ time, label, detail }) => ({ time, label, detail }));
  }

  // ---------------- Agro: tenant unico (Rosendo), animalMovements + auditLog. ----

  private async loadAgroWorkspace() {
    const rows = await this.databaseService.query<(RowDataPacket & { workspace_json: unknown })[]>(
      `SELECT workspace_json FROM saas_agro_workspaces WHERE tenant_id = ? AND workspace_key = 'public'`,
      [AGRO_TENANT_ID]
    );
    return this.parseJson(rows[0]?.workspace_json);
  }

  // Agro separado por cuenta (17/11/2026): Rosendo y Contador. Cada alta,
  // edicion o borrado (animales y contabilidad) trae quien lo hizo; lo cargado
  // antes de que existiera el autor se cuenta como Rosendo (acordado).
  private collectAgroEvents(data: any, startMs: number, endMs: number) {
    const fieldsById: Record<string, string> = {};
    (data.fields || []).forEach((f: { id: string; name: string }) => (fieldsById[f.id] = f.name));
    const estById: Record<string, string> = {};
    (data.establishments || []).forEach((e: { id: string; name: string }) => (estById[e.id] = e.name));
    const who = (value?: string) => (value && AGRO_CLIENT_LABELS[value] ? value : "rosendo");
    const events: Array<{ t: number; by: string; label: string; detail: string }> = [];
    const inRange = (t: number) => t >= startMs && t < endMs;
    const timeOf = (entry: { id: string; at?: string }) => (entry.at ? Date.parse(entry.at) : extractEpoch(entry.id));

    for (const m of (Array.isArray(data.animalMovements) ? data.animalMovements : []) as Array<any>) {
      const t = extractEpoch(m.id);
      if (!inRange(t)) continue;
      const place = `${estById[m.establishmentId] || "?"} / ${fieldsById[m.fieldId] || "?"}`;
      events.push({ t, by: who(m.createdBy), label: AGRO_KIND_LABELS[m.kind] || m.kind, detail: `${place} · ${m.species} · cant. ${m.quantity}` });
    }
    for (const e of (Array.isArray(data.auditLog) ? data.auditLog : []) as Array<any>) {
      const t = timeOf(e);
      if (!inRange(t) || (e.action !== "edit" && e.action !== "delete")) continue;
      events.push({ t, by: who(e.by), label: e.action === "edit" ? "Edición (animales)" : "Borrado (animales)", detail: `Movimiento ${e.movementId || ""}` });
    }
    for (const entry of (Array.isArray(data.accountingEntries) ? data.accountingEntries : []) as Array<any>) {
      const t = extractEpoch(entry.id);
      if (!inRange(t)) continue;
      events.push({
        t,
        by: who(entry.createdBy),
        label: entry.type === "income" ? "Alta contable (ingreso)" : "Alta contable (egreso)",
        detail: `${entry.concept} · ${entry.currency} ${Number(entry.netAmount || 0).toFixed(2)}`
      });
    }
    for (const e of (Array.isArray(data.accountingAuditLog) ? data.accountingAuditLog : []) as Array<any>) {
      const t = timeOf(e);
      if (!inRange(t) || (e.action !== "edit" && e.action !== "delete")) continue;
      events.push({ t, by: who(e.by), label: e.action === "edit" ? "Edición contable" : "Borrado contable", detail: e.explanation || `Asiento ${e.entryId || ""}` });
    }
    return events;
  }

  // Ingresos (logins) a Agro del dia, por cuenta (17/11/2026, pedido explicito:
  // "si Rosendo se loguea que me avise, y si se loguea el contador tambien").
  private async agroLoginEvents(dayLabel?: string) {
    const { start, end } = dayRangeUtc(dayLabel);
    const rows = await this.databaseService.query<(RowDataPacket & { when_raw: string; username: string })[]>(
      `SELECT DATE_FORMAT(s.created_at, '%Y-%m-%dT%H:%i:%s') AS when_raw, u.username
       FROM saas_agro_sessions s INNER JOIN saas_agro_users u ON u.id = s.user_id
       WHERE s.created_at >= ? AND s.created_at < ?`,
      [start, end]
    );
    return rows
      .filter((row) => AGRO_CLIENT_LABELS[row.username])
      .map((row) => ({ t: Date.parse(`${row.when_raw}Z`), by: row.username, label: "Ingresó a la app", detail: `${AGRO_CLIENT_LABELS[row.username]} inició sesión` }));
  }

  private async countAgroByClient(dayLabel?: string): Promise<MovimientosClientSummary[]> {
    const [data, logins] = await Promise.all([this.loadAgroWorkspace(), this.agroLoginEvents(dayLabel)]);
    const { startMs, endMs } = epochRangeMs(dayLabel);
    const events = [...(data ? this.collectAgroEvents(data, startMs, endMs) : []), ...logins];
    return Object.entries(AGRO_CLIENT_LABELS).map(([key, label]) => ({ key, label, count: events.filter((e) => e.by === key).length }));
  }

  private async detailAgro(dayLabel?: string, client?: string): Promise<MovimientosDetailItem[]> {
    const [data, logins] = await Promise.all([this.loadAgroWorkspace(), this.agroLoginEvents(dayLabel)]);
    const { startMs, endMs } = epochRangeMs(dayLabel);
    return [...(data ? this.collectAgroEvents(data, startMs, endMs) : []), ...logins]
      .filter((e) => !client || e.by === client)
      .sort((a, b) => b.t - a.t)
      .map((e) => ({
        time: new Date(e.t).toLocaleTimeString("es-UY", { timeZone: "America/Montevideo", hour: "2-digit", minute: "2-digit" }),
        label: client ? e.label : `${e.label} (${AGRO_CLIENT_LABELS[e.by]})`,
        detail: e.detail
      }));
  }

  private parseJson(raw: unknown): any {
    if (!raw) return null;
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  }
}
