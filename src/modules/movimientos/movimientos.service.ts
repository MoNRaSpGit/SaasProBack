import { Injectable, Logger } from "@nestjs/common";
import { RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { dayRangeUtc, epochRangeMs, extractEpoch, formatMontevideoTime } from "./movimientos.dateUtils";

// clients: sub-tarjetas por cliente (hoy solo Gym, 23/10/2026: "entro a
// Gym y me sale Ale Gym y Pablo M").
export type MovimientosClientSummary = { key: string; label: string; count: number };
export type MovimientosVisitStats = { visits: number; views: number; carts: number; whatsapp: number };
export type MovimientosAppSummary = { key: string; label: string; count: number; clients?: MovimientosClientSummary[]; visitsToday?: number; visitStats?: MovimientosVisitStats; referrals?: { visits: number; whatsapp: number }; breakdown?: MovimientosBreakdown[]; lastAt?: string | null; unavailable?: boolean };
// Que paso en el dia, agrupado ("Venta" x2, "Pago de cuenta" x1).
export type MovimientosBreakdown = { label: string; count: number; kind?: MovimientosDetailItem["kind"] };
// kind: movimientos que la app resalta con otro color (hoy solo ventas a credito).
export type MovimientosDetailItem = { time: string; label: string; detail: string; kind?: "credito" | "referido" };

// Gym: cada workspace es un cliente (gimnasio). Los de demo y el
// "public" (pruebas internas) van juntos en "Otros".
export const GYM_OTHERS_KEY = "otros";
function isRealGymWorkspace(workspaceKey: string) {
  // "vistaprevia" es el usuario nuestro para mirar cambios visuales.
  return workspaceKey !== "public" && workspaceKey !== "vistaprevia" && !workspaceKey.startsWith("demo");
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
  correction_out: "Corrección -",
  category_change_in: "Cambio de categoría (entrada)",
  category_change_out: "Cambio de categoría (salida)"
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

// Marca de visitantes de Qq que llegan desde la web de Logic Lab.
const REFERRAL_TAG = "[LL]";

// Web de Logic Lab: eventos que terminan en un mensaje de WhatsApp.
const LOGICLAB_CONTACT_EVENTS = ["wa_click", "cotizador_enviar"];
const LOGICLAB_EVENT_LABELS: Record<string, string> = {
  visit: "Entró a la web",
  ver_video: "Vio un video",
  wa_click: "Tocó WhatsApp",
  cotizador_abrir: "Abrió el cotizador",
  cotizador_enviar: "Envió un presupuesto"
};

// Cada tabla de auditoria de este monorepo tiene sus propias columnas (no
// todas tienen entity_type/entity_label/summary/actor) -- ver los distintos
// scripts/inspect-*-audit.js, que son la fuente de verdad de cada esquema.
const SQL_AUDIT_TABLES: Record<
  "piloto" | "gaby" | "distribuidora" | "qq" | "ropa" | "juez",
  { table: string; timeCol: string; columns: string; actionLabels?: Record<string, string>; buildDetail: (row: AuditRow, service: MovimientosService) => string }
> = {
  piloto: {
    table: "saas_piloto_audit_log",
    timeCol: "occurred_at",
    columns: "action, entity_type, entity_id, entity_label, details",
    actionLabels: {
      create: "Alta",
      update: "Edición",
      sale: "Venta",
      payment: "Pago de cuenta",
      delete: "Borrado"
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
  private readonly logger = new Logger(MovimientosService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  // Memoria corta (18/11/2026): los workspaces de Agro (~1,1 MB de JSON) y de
  // Gym se bajaban y parseaban de nuevo en CADA pedido (resumen, Rosendo,
  // Contador...), y el primero que se abria tardaba segundos. Ahora se guardan
  // 30 segundos: abrir Rosendo y despues Contador usa la misma copia. Si dos
  // pedidos llegan juntos, comparten la misma descarga. Movimientos puede
  // mostrar algo con hasta 30 s de atraso, que para mirar el dia alcanza.
  private static readonly CACHE_TTL_MS = 30_000;
  private readonly cache = new Map<string, { at: number; value: Promise<unknown> }>();

  private cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < MovimientosService.CACHE_TTL_MS) return hit.value as Promise<T>;
    const value = load().catch((error) => {
      this.cache.delete(key);
      throw error;
    });
    this.cache.set(key, { at: Date.now(), value });
    return value;
  }

  // dayLabel (YYYY-MM-DD, Montevideo): dia a resumir; sin el, hoy.
  // (27/11/2026, rediseño) Cada proyecto sale del MISMO detalle que se abre al
  // tocarlo, asi el numero de la portada siempre coincide con la lista. Si uno
  // falla, los demas se muestran igual.
  async getSummary(dayLabel?: string): Promise<MovimientosAppSummary[]> {
    const apps: Array<{ key: string; label: string }> = [
      { key: "gym", label: "Gym" },
      { key: "piloto", label: "Piloto" },
      { key: "gaby", label: "Gaby" },
      { key: "eme", label: "Eme" },
      { key: "agro", label: "Agro" },
      { key: "distribuidora", label: "Distribuidora" },
      { key: "qq", label: "QQ" },
      { key: "logiclab", label: "Logic Lab (mi web)" },
      { key: "ropa", label: "Ropa" },
      { key: "juez", label: "Juez" },
      { key: "camiones", label: "Camiones" },
      { key: "oriol", label: "Oriol · cuenta corriente" },
      { key: "reservas", label: "Reservas (peluquería)" }
    ];
    return Promise.all(apps.map((app) => this.summarizeApp(app.key, app.label, dayLabel)));
  }

  private async summarizeApp(key: string, label: string, dayLabel?: string): Promise<MovimientosAppSummary> {
    try {
      const [items, lastAt, clients, extra] = await Promise.all([
        this.getDetail(key, dayLabel),
        this.lastActivity(key).catch(() => null),
        key === "gym" ? this.countGymByClient(dayLabel) : key === "agro" ? this.countAgroByClient(dayLabel) : undefined,
        this.summaryExtras(key, dayLabel)
      ]);
      return { key, label, count: items.length, breakdown: this.groupItems(items), lastAt, ...(clients ? { clients } : {}), ...extra };
    } catch (error) {
      this.logger.error(`Resumen de ${key}: ${error instanceof Error ? error.message : String(error)}`);
      return { key, label, count: 0, unavailable: true };
    }
  }

  // Tiendas: visitas del dia (y en QQ lo que llega desde Logic Lab).
  private async summaryExtras(key: string, dayLabel?: string): Promise<Partial<MovimientosAppSummary>> {
    if (key === "logiclab") return { referrals: await this.countLogiclabReferrals(dayLabel) };
    if (key !== "qq" && key !== "ropa") return {};
    const [visitStats, referrals] = await Promise.all([
      this.countVisits(key === "qq" ? "saas_qq_audit_log" : "saas_ropa_audit_log", dayLabel),
      key === "qq" ? this.countReferrals(dayLabel) : undefined
    ]);
    return { visitsToday: visitStats.visits, visitStats, ...(referrals ? { referrals } : {}) };
  }

  private groupItems(items: MovimientosDetailItem[]): MovimientosBreakdown[] {
    const groups = new Map<string, MovimientosBreakdown>();
    for (const item of items) {
      // Sin el "(Rosendo)" / "(alegym)" del final: en la portada se agrupa por accion.
      const label = item.label.replace(/ \([^()]*\)$/, "");
      const group = groups.get(label) ?? { label, count: 0, ...(item.kind ? { kind: item.kind } : {}) };
      group.count += 1;
      groups.set(label, group);
    }
    return [...groups.values()].sort((a, b) => b.count - a.count);
  }

  // Ultimo movimiento de siempre (ISO UTC), para ver quien esta quieto.
  private async lastActivity(key: string): Promise<string | null> {
    if (key === "gym") {
      let last = 0;
      for (const row of await this.loadGymWorkspaces()) {
        if (!isRealGymWorkspace(row.workspace_key)) continue;
        const log = this.parseJson(row.workspace_json)?.auditLog;
        for (const entry of (Array.isArray(log) ? log : []) as { timestamp?: string }[]) {
          const t = entry.timestamp ? Date.parse(entry.timestamp) : 0;
          if (t > last) last = t;
        }
      }
      return last ? new Date(last).toISOString() : null;
    }
    if (key === "agro") {
      const data = await this.loadAgroWorkspace();
      const events = data ? this.collectAgroEvents(data, 1, Number.MAX_SAFE_INTEGER) : [];
      const login = await this.maxDate([["saas_agro_sessions", "created_at"]]);
      const last = events.reduce((max, event) => Math.max(max, event.t), login ? Date.parse(login) : 0);
      return last ? new Date(last).toISOString() : null;
    }
    // Tablas y columnas fijas de este archivo (nunca del pedido).
    // El tercer dato filtra lo que no cuenta (mismo criterio que el detalle).
    const sources: Record<string, Array<[string, string, string?]>> = {
      eme: [["saas_eme_orders", "created_at"]],
      camiones: [
        ["saas_camiones_trips", "created_at"],
        ["saas_camiones_trips", "driver_done_at"],
        ["saas_camiones_trips", "driver_paid_at"],
        ["saas_camiones_trips", "paid_at"]
      ],
      logiclab: [["saas_logiclab_events", "occurred_at"]],
      oriol: [
        ["saas_oriol_clientes", "created_at"],
        ["saas_oriol_pagos_credito", "fecha"],
        ["saas_oriol_ventas", "fecha", "metodo_pago = 'credito'"]
      ],
      reservas: [
        ["saas_peluqueria_reservations", "created_at", "client_phone NOT LIKE '0990000%'"],
        ["saas_peluqueria_clients", "created_at", "phone_norm NOT LIKE '0990000%'"],
        ["saas_peluqueria_sessions", "created_at"]
      ]
    };
    const audit = SQL_AUDIT_TABLES[key as keyof typeof SQL_AUDIT_TABLES];
    return this.maxDate(audit ? [[audit.table, audit.timeCol]] : (sources[key] ?? []));
  }

  private async maxDate(sources: Array<[string, string, string?]>): Promise<string | null> {
    const values = await Promise.all(
      sources.map(async ([table, column, where]) => {
        const rows = await this.databaseService.query<(RowDataPacket & { t: string | null })[]>(
          `SELECT DATE_FORMAT(MAX(${column}), '%Y-%m-%dT%H:%i:%sZ') AS t FROM ${table}${where ? ` WHERE ${where}` : ""}`
        );
        return rows[0]?.t ?? null;
      })
    );
    return values.filter((value): value is string => value !== null).sort().pop() ?? null;
  }

  // Visitas y toques en WhatsApp en Qq que vinieron de la web de Logic Lab.
  private async countReferrals(dayLabel?: string) {
    const { start, end } = dayRangeUtc(dayLabel);
    const rows = await this.databaseService.query<(RowDataPacket & { action: string; total: number })[]>(
      `SELECT action, COUNT(*) AS total FROM saas_qq_audit_log
       WHERE entity_type = 'visitor' AND occurred_at >= ? AND occurred_at < ?
         AND action IN ('visit', 'whatsapp_click') AND entity_label LIKE ?
       GROUP BY action`,
      [start, end, `${REFERRAL_TAG}%`]
    );
    const count = (action: string) => Number(rows.find((row) => row.action === action)?.total ?? 0);
    return { visits: count("visit"), whatsapp: count("whatsapp_click") };
  }

  // ---------------- Web de Logic Lab (27/11/2026): eventos de la landing. Los
  // que llegan desde Qq vienen con src = "ref-qq" y se resaltan. Si la tabla
  // todavia no existe, cuenta 0 y no rompe el resumen.
  private async loadLogiclab(dayLabel?: string) {
    const { start, end } = dayRangeUtc(dayLabel);
    return this.databaseService
      .query<(RowDataPacket & { when_raw: string; event: string; rubro: string | null; section: string | null; plan: string | null; src: string | null })[]>(
        `SELECT DATE_FORMAT(occurred_at, '%Y-%m-%dT%H:%i:%s') AS when_raw, event, rubro, section, plan, src
         FROM saas_logiclab_events WHERE occurred_at >= ? AND occurred_at < ?
         ORDER BY occurred_at DESC`,
        [start, end]
      )
      .catch(() => []);
  }

  private async countLogiclabReferrals(dayLabel?: string) {
    const referred = (await this.loadLogiclab(dayLabel)).filter((row) => row.src === "ref-qq");
    return {
      visits: referred.filter((row) => row.event === "visit").length,
      whatsapp: referred.filter((row) => LOGICLAB_CONTACT_EVENTS.includes(row.event)).length
    };
  }

  private async detailLogiclab(dayLabel?: string): Promise<MovimientosDetailItem[]> {
    const rows = await this.loadLogiclab(dayLabel);
    return rows.map((row) => {
      const time = formatMontevideoTime(row.when_raw);
      const fromQq = row.src === "ref-qq";
      const parts = [row.rubro, row.section, row.plan, fromQq ? "" : row.src].filter(Boolean).join(" · ");
      if (fromQq && LOGICLAB_CONTACT_EVENTS.includes(row.event)) {
        return { time, label: "⭐ Posible venta desde Qq · WhatsApp", detail: parts || "Tocó WhatsApp", kind: "referido" as const };
      }
      const detail = [parts, fromQq ? "Llegó desde Qq" : ""].filter(Boolean).join(" · ");
      return { time, label: LOGICLAB_EVENT_LABELS[row.event] || row.event, detail };
    });
  }

  async getDetail(appKey: string, dayLabel?: string, client?: string): Promise<MovimientosDetailItem[]> {
    switch (appKey) {
      case "gym":
        return this.detailGym(dayLabel, client);
      case "agro":
        return this.detailAgro(dayLabel, client);
      case "camiones":
        return this.detailCamiones(dayLabel);
      case "oriol":
        return this.detailOriol(dayLabel);
      case "logiclab":
        return this.detailLogiclab(dayLabel);
      case "reservas":
        return this.detailReservas(dayLabel);
      case "eme":
        return this.detailEme(dayLabel);
      case "piloto":
        return this.detailPiloto(dayLabel);
      case "gaby":
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
  // 21/11/2026: una sola consulta agrupada trae visitas, productos vistos,
  // agregados al carrito y clics en WhatsApp del dia (lo mismo que ve la
  // clienta en su pestaña Visitas, mas WhatsApp, que es solo para nosotros).
  private async countVisits(table: "saas_qq_audit_log" | "saas_ropa_audit_log", dayLabel?: string) {
    const { start, end } = dayRangeUtc(dayLabel);
    const rows = await this.databaseService.query<(RowDataPacket & { action: string; total: number })[]>(
      `SELECT action, COUNT(*) AS total FROM ${table}
       WHERE entity_type = 'visitor' AND occurred_at >= ? AND occurred_at < ?
         AND action IN ('visit', 'view_product', 'add_to_cart', 'whatsapp_click')
       GROUP BY action`,
      [start, end]
    );
    const count = (action: string) => Number(rows.find((row) => row.action === action)?.total ?? 0);
    return { visits: count("visit"), views: count("view_product"), carts: count("add_to_cart"), whatsapp: count("whatsapp_click") };
  }

  // ---------------- Camiones (15/11/2026, pedido explicito: reemplaza a GPS):
  // no tiene tabla de auditoria propia, se arma con las fechas reales de cada
  // viaje: ingresado (created_at), finalizado por el camionero
  // (driver_done_at), pagado al camionero (driver_paid_at) y cobrado al
  // cliente (paid_at). ----

  // ---------------- Oriol (21/11/2026, pedido explicito): SOLO cuenta
  // corriente. No tiene auditoria propia: se arma con las fechas reales de
  // clientes nuevos, ventas a credito y pagos de cuenta corriente. ----

  // ---- Reservas / peluqueria (25/11/2026, pedido explicito: "ver si alguien
  // se registra, si entra, si la usa"). Sin auditoria propia: se arma con las
  // fechas reales de las tablas: reservas hechas, clientes nuevos de cada
  // local e ingresos del dueño (sesiones). Los turnos de EJEMPLO (celular
  // 0990000NN, ver scripts/seed-peluqueria-demo-reservations.js) no cuentan.
  // Ojo: cerrar sesion borra la sesion, asi que un ingreso con "Salir"
  // posterior ya no aparece. Las VISITAS a la pagina de reservar (sin
  // reservar) todavia no se registran. ----

  private async detailReservas(dayLabel?: string): Promise<MovimientosDetailItem[]> {
    const { start, end } = dayRangeUtc(dayLabel);
    const [reservations, clients, logins] = await Promise.all([
      this.databaseService.query<(RowDataPacket & { t: string; salon: string; peluquero: string; client_name: string; turno: string; hora: string })[]>(
        `SELECT DATE_FORMAT(r.created_at, '%Y-%m-%dT%H:%i:%s') AS t, s.name AS salon, r.peluquero, r.client_name,
                DATE_FORMAT(r.reservation_date, '%d/%m') AS turno, r.reservation_time AS hora
         FROM saas_peluqueria_reservations r JOIN saas_peluqueria_salons s ON s.id = r.salon_id
         WHERE r.created_at >= ? AND r.created_at < ? AND r.client_phone NOT LIKE '0990000%'`,
        [start, end]
      ),
      this.databaseService.query<(RowDataPacket & { t: string; salon: string; name: string })[]>(
        `SELECT DATE_FORMAT(c.created_at, '%Y-%m-%dT%H:%i:%s') AS t, s.name AS salon, c.name
         FROM saas_peluqueria_clients c JOIN saas_peluqueria_salons s ON s.id = c.salon_id
         WHERE c.created_at >= ? AND c.created_at < ? AND c.phone_norm NOT LIKE '0990000%'`,
        [start, end]
      ),
      this.databaseService.query<(RowDataPacket & { t: string; salon: string; username: string })[]>(
        `SELECT DATE_FORMAT(se.created_at, '%Y-%m-%dT%H:%i:%s') AS t, s.name AS salon, u.username
         FROM saas_peluqueria_sessions se
         JOIN saas_peluqueria_users u ON u.id = se.user_id
         JOIN saas_peluqueria_salons s ON s.id = u.salon_id
         WHERE se.created_at >= ? AND se.created_at < ?`,
        [start, end]
      )
    ]);
    const items: Array<MovimientosDetailItem & { t: string }> = [
      ...reservations.map((row) => ({
        time: formatMontevideoTime(row.t),
        label: "Reserva nueva",
        detail: `${row.client_name} · ${row.peluquero} · turno ${row.turno} ${row.hora} · ${row.salon}`,
        t: row.t
      })),
      ...clients.map((row) => ({ time: formatMontevideoTime(row.t), label: "Cliente nuevo", detail: `${row.name} · ${row.salon}`, t: row.t })),
      ...logins.map((row) => ({ time: formatMontevideoTime(row.t), label: "Ingreso del dueño", detail: `${row.username} · ${row.salon}`, t: row.t }))
    ];
    return items.sort((a, b) => b.t.localeCompare(a.t)).map(({ t: _t, ...item }) => item);
  }

  private async detailOriol(dayLabel?: string): Promise<MovimientosDetailItem[]> {
    const { start, end } = dayRangeUtc(dayLabel);
    const [clients, sales, payments] = await Promise.all([
      this.databaseService.query<(RowDataPacket & { t: string; nombre: string })[]>(
        `SELECT DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s') AS t, nombre FROM saas_oriol_clientes WHERE created_at >= ? AND created_at < ?`,
        [start, end]
      ),
      this.databaseService.query<(RowDataPacket & { t: string; nombre: string | null; pesos: string; dolares: string })[]>(
        `SELECT DATE_FORMAT(v.fecha, '%Y-%m-%dT%H:%i:%s') AS t, c.nombre, v.total_pesos AS pesos, v.total_dolares AS dolares
         FROM saas_oriol_ventas v LEFT JOIN saas_oriol_clientes c ON c.id = v.cliente_id
         WHERE v.metodo_pago = 'credito' AND v.fecha >= ? AND v.fecha < ?`,
        [start, end]
      ),
      this.databaseService.query<(RowDataPacket & { t: string; nombre: string | null; moneda: string; monto: string; tipo: string })[]>(
        `SELECT DATE_FORMAT(p.fecha, '%Y-%m-%dT%H:%i:%s') AS t, c.nombre, p.moneda, p.monto, p.tipo
         FROM saas_oriol_pagos_credito p LEFT JOIN saas_oriol_clientes c ON c.id = p.cliente_id
         WHERE p.fecha >= ? AND p.fecha < ?`,
        [start, end]
      )
    ]);
    const amount = (pesos: number, dolares: number) =>
      [pesos > 0 ? `$${Math.round(pesos)}` : "", dolares > 0 ? `US$${dolares.toFixed(2)}` : ""].filter(Boolean).join(" + ") || "$0";
    const items: Array<MovimientosDetailItem & { t: string }> = [
      ...clients.map((row) => ({ time: formatMontevideoTime(row.t), label: "Cliente nuevo", detail: row.nombre, t: row.t })),
      ...sales.map((row) => ({
        time: formatMontevideoTime(row.t),
        label: "Venta a cuenta corriente",
        detail: `${row.nombre ?? "?"} · ${amount(Number(row.pesos), Number(row.dolares))}`,
        t: row.t
      })),
      ...payments.map((row) => ({
        time: formatMontevideoTime(row.t),
        label: "Pago de cuenta corriente",
        detail: `${row.nombre ?? "?"} · ${row.moneda === "dolares" || row.moneda === "USD" ? "US$" : "$"}${Number(row.monto).toFixed(2)}${row.tipo ? " · " + row.tipo : ""}`,
        t: row.t
      }))
    ];
    return items.sort((a, b) => b.t.localeCompare(a.t)).map(({ t: _t, ...item }) => item);
  }

  // Eme (27/11/2026, pedido explicito: "cuando haga una venta, no cada pestaña
  // que abre"): cada pedido AGENDADO es una venta, aunque despues se anule.
  private async detailEme(dayLabel?: string): Promise<MovimientosDetailItem[]> {
    const { start, end } = dayRangeUtc(dayLabel);
    const rows = await this.databaseService.query<
      (RowDataPacket & { t: string; number: number; client_name: string | null; kind: string; table_no: number | null; workspace_id: number })[]
    >(
      `SELECT DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s') AS t, number, client_name, kind, table_no, workspace_id
       FROM saas_eme_orders WHERE created_at >= ? AND created_at < ?
       ORDER BY created_at DESC`,
      [start, end]
    );
    const kinds: Record<string, string> = { delivery: "Delivery", retiro: "Retiro", salon: "Salón" };
    return rows.map((row) => ({
      time: formatMontevideoTime(row.t),
      label: "Venta",
      detail: [
        `Pedido #${row.number}`,
        row.client_name || "",
        row.table_no ? `Mesa ${row.table_no}` : (kinds[row.kind] ?? row.kind),
        // El espacio 1 es el de nuestro usuario admin.
        row.workspace_id === 1 ? "(admin)" : ""
      ]
        .filter(Boolean)
        .join(" · ")
    }));
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

    // Auditoria (16/11/2026): aprobaciones, cambios de valor, reasignaciones,
    // ediciones y borrados, con quien lo hizo.
    const AUDIT_LABELS: Record<string, string> = {
      trip_approved: "Viaje aprobado",
      trip_value_changed: "Valor de viaje cambiado",
      trip_reassigned: "Viaje reasignado",
      trip_edited: "Viaje editado",
      trip_deleted: "Viaje eliminado"
    };
    const auditRows = await this.databaseService
      .query<(RowDataPacket & { when_raw: string; action: string; actor_name: string | null; summary: string })[]>(
        `SELECT DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s') AS when_raw, action, actor_name, summary
         FROM saas_camiones_audit_log WHERE created_at >= ? AND created_at < ? ORDER BY created_at DESC`,
        [start, end]
      )
      .catch(() => []);
    for (const row of auditRows) {
      items.push({
        time: formatMontevideoTime(row.when_raw),
        label: AUDIT_LABELS[row.action] ?? row.action,
        detail: `${row.actor_name || "?"}: ${row.summary}`,
        t: row.when_raw
      });
    }

    return items.sort((x, y) => y.t.localeCompare(x.t)).map(({ time, label, detail }) => ({ time, label, detail }));
  }

  // ---------------- Piloto / Distribuidora / QQ / Juez: misma tabla de
  // auditoria SQL en los 4 casos, mismo rango de "hoy" en Montevideo. ----

  // Piloto (25/11/2026, pedido explicito): las ventas a CREDITO (fiado) se ven
  // como "Crédito" con el monto y el nombre del cliente ("$150 · Pablo Porto")
  // en vez de "Venta #123". Se cruza la auditoria con las boletas de cuenta
  // corriente (saas_piloto_account_entries.sale_id). Solo lectura: no se toco
  // nada de Piloto, todo sale de lo que ya se guarda.
  private async detailPiloto(dayLabel?: string): Promise<MovimientosDetailItem[]> {
    const { table, timeCol, columns, actionLabels, buildDetail } = SQL_AUDIT_TABLES.piloto;
    const { start, end } = dayRangeUtc(dayLabel);
    const [creditSales, rows, entries] = await Promise.all([
      // Por la venta misma: sigue marcada como credito aunque despues se salde
      // la cuenta o se borre el cliente (ahi ya no hay boleta con el nombre).
      this.databaseService.query<(RowDataPacket & { id: number; total_amount: string })[]>(
        `SELECT id, total_amount FROM saas_piloto_sales
         WHERE payment_method = 'credito' AND created_at >= ? AND created_at < ?`,
        [start, end]
      ),
      this.databaseService.query<AuditRow[]>(
        `SELECT DATE_FORMAT(${timeCol}, '%Y-%m-%dT%H:%i:%s') AS when_raw, ${columns}
         FROM ${table}
         WHERE ${timeCol} >= ? AND ${timeCol} < ?`,
        [start, end]
      ),
      this.databaseService.query<(RowDataPacket & { sale_id: number | null; total: string; name: string; t: string })[]>(
        `SELECT e.sale_id, e.total, c.name, DATE_FORMAT(e.created_at, '%Y-%m-%dT%H:%i:%s') AS t
         FROM saas_piloto_account_entries e JOIN saas_piloto_clients c ON c.id = e.client_id
         WHERE e.created_at >= ? AND e.created_at < ?`,
        [start, end]
      )
    ]);

    const creditText = (entry: { total: string; name: string }) => `$${Number(entry.total)} · ${entry.name}`;
    const bySale = new Map<string, (typeof entries)[number]>();
    for (const entry of entries) if (entry.sale_id != null) bySale.set(String(entry.sale_id), entry);
    const used = new Set<(typeof entries)[number]>();

    const items: Array<MovimientosDetailItem & { t: string }> = rows.map((row) => {
      // Fiado nuevo (entidad "account"): el id de la venta viene en details.
      const saleId =
        row.action !== "sale"
          ? ""
          : row.entity_type === "account"
            ? String(this.parseDetails(row.details)?.saleId ?? "")
            : String(row.entity_id ?? "");
      const credit = saleId ? bySale.get(saleId) : undefined;
      const creditSale = saleId ? creditSales.find((sale) => String(sale.id) === saleId) : undefined;
      if (credit || creditSale) {
        if (credit) used.add(credit);
        const detail = credit ? creditText(credit) : `$${Number(creditSale?.total_amount)}`;
        return { time: formatMontevideoTime(row.when_raw), label: "Crédito", detail, kind: "credito" as const, t: row.when_raw };
      }
      const label = (actionLabels && actionLabels[row.action]) || String(row.action || "").toUpperCase();
      return { time: formatMontevideoTime(row.when_raw), label, detail: String(buildDetail(row, this) || ""), t: row.when_raw };
    });

    // Boletas de credito sin fila de auditoria (por las dudas): igual se ven.
    for (const entry of entries) {
      if (!used.has(entry)) items.push({ time: formatMontevideoTime(entry.t), label: "Crédito", detail: creditText(entry), kind: "credito", t: entry.t });
    }

    return items.sort((a, b) => b.t.localeCompare(a.t)).map(({ t: _t, ...item }) => item);
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
      const detail = String(buildDetail(row, this) || "");
      const time = formatMontevideoTime(row.when_raw);
      // Qq (27/11/2026): visitantes derivados desde la web de Logic Lab, marcados
      // con "[LL]". El WhatsApp se resalta: es una posible venta nuestra.
      if (appKey === "qq" && row.entity_type === "visitor" && detail.startsWith(REFERRAL_TAG)) {
        const rest = detail.slice(REFERRAL_TAG.length).trim();
        if (row.action === "whatsapp_click") {
          return { time, label: "⭐ Posible venta tuya · WhatsApp", detail: rest || "Fue a WhatsApp", kind: "referido" as const };
        }
        return { time, label, detail: "Llegó desde la web de Logic Lab" };
      }
      return { time, label, detail };
    });
  }

  private parseDetails(raw: unknown): { saleId?: number } | null {
    try {
      return this.parseJson(raw);
    } catch {
      return null;
    }
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
    return this.cached("gym-workspaces", () =>
      this.databaseService.query<(RowDataPacket & { workspace_key: string; workspace_json: unknown })[]>(
        `SELECT workspace_key, workspace_json FROM saas_gym_workspaces`
      )
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
    return this.cached("agro-workspace", async () => {
      const rows = await this.databaseService.query<(RowDataPacket & { workspace_json: unknown })[]>(
        `SELECT workspace_json FROM saas_agro_workspaces WHERE tenant_id = ? AND workspace_key = 'public'`,
        [AGRO_TENANT_ID]
      );
      return this.parseJson(rows[0]?.workspace_json);
    });
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
