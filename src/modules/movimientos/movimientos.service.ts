import { Injectable } from "@nestjs/common";
import { RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { dayRangeUtc, epochRangeMs, extractEpoch, formatMontevideoTime } from "./movimientos.dateUtils";

export type MovimientosAppSummary = { key: string; label: string; count: number };
export type MovimientosDetailItem = { time: string; label: string; detail: string };

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
  "piloto" | "distribuidora" | "qq" | "juez",
  { table: string; timeCol: string; columns: string; actionLabels?: Record<string, string>; buildDetail: (row: AuditRow, service: MovimientosService) => string }
> = {
  piloto: {
    table: "saas_piloto_audit_log",
    timeCol: "occurred_at",
    columns: "action, entity_type, entity_id, entity_label, details",
    buildDetail: (row, service) =>
      row.entity_label || service.summarizeJsonDetails(row.details) || `${row.entity_type || ""} #${row.entity_id ?? ""}`
  },
  distribuidora: {
    table: "saas_distribuidora_audit_log",
    timeCol: "occurred_at",
    columns: "action, entity_id, summary",
    buildDetail: (row) => row.summary || `#${row.entity_id ?? ""}`
  },
  qq: {
    table: "saas_qq_audit_log",
    timeCol: "occurred_at",
    columns: "action, entity_type, entity_id, entity_label, actor_email, actor_role, details",
    buildDetail: (row, service) =>
      row.entity_label ||
      service.summarizeJsonDetails(row.details) ||
      row.actor_email ||
      `${row.entity_type || ""} #${row.entity_id ?? ""}`
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

  async getSummary(): Promise<MovimientosAppSummary[]> {
    const [piloto, gym, agro, distribuidora, qq, juez] = await Promise.all([
      this.countSqlAudit("piloto"),
      this.countGym(),
      this.countAgro(),
      this.countSqlAudit("distribuidora"),
      this.countSqlAudit("qq"),
      this.countSqlAudit("juez")
    ]);

    return [
      { key: "gym", label: "Gym", count: gym },
      { key: "piloto", label: "Piloto", count: piloto },
      { key: "agro", label: "Agro", count: agro },
      { key: "distribuidora", label: "Distribuidora", count: distribuidora },
      { key: "qq", label: "QQ", count: qq },
      { key: "juez", label: "Juez", count: juez }
    ];
  }

  async getDetail(appKey: string, dayLabel?: string): Promise<MovimientosDetailItem[]> {
    switch (appKey) {
      case "gym":
        return this.detailGym(dayLabel);
      case "agro":
        return this.detailAgro(dayLabel);
      case "piloto":
      case "distribuidora":
      case "qq":
      case "juez":
        return this.detailSqlAudit(appKey, dayLabel);
      default:
        return [];
    }
  }

  // ---------------- Piloto / Distribuidora / QQ / Juez: misma tabla de
  // auditoria SQL en los 4 casos, mismo rango de "hoy" en Montevideo. ----

  private async countSqlAudit(appKey: keyof typeof SQL_AUDIT_TABLES) {
    const { table, timeCol } = SQL_AUDIT_TABLES[appKey];
    const { start, end } = dayRangeUtc();
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

  private async countGym() {
    const rows = await this.loadGymWorkspaces();
    const { startMs, endMs } = epochRangeMs();
    let count = 0;
    for (const row of rows) {
      const data = this.parseJson(row.workspace_json);
      const auditLog = Array.isArray(data?.auditLog) ? data.auditLog : [];
      count += auditLog.filter((entry: { timestamp?: string }) => {
        if (!entry.timestamp) return false;
        const t = new Date(entry.timestamp).getTime();
        return t >= startMs && t < endMs;
      }).length;
    }
    return count;
  }

  private async detailGym(dayLabel?: string): Promise<MovimientosDetailItem[]> {
    const rows = await this.loadGymWorkspaces();
    const { startMs, endMs } = epochRangeMs(dayLabel);
    const items: MovimientosDetailItem[] = [];

    for (const row of rows) {
      const data = this.parseJson(row.workspace_json);
      const auditLog = Array.isArray(data?.auditLog) ? data.auditLog : [];
      for (const entry of auditLog as { timestamp?: string; action?: string; details?: string }[]) {
        if (!entry.timestamp) continue;
        const t = new Date(entry.timestamp).getTime();
        if (t < startMs || t >= endMs) continue;
        items.push({
          time: new Date(entry.timestamp).toLocaleTimeString("es-UY", { timeZone: "America/Montevideo", hour: "2-digit", minute: "2-digit" }),
          label: `${GYM_ACTION_LABELS[entry.action || ""] || entry.action || "Movimiento"} (${row.workspace_key})`,
          detail: entry.details || ""
        });
      }
    }

    return items.sort((a, b) => b.time.localeCompare(a.time));
  }

  // ---------------- Agro: tenant unico (Rosendo), animalMovements + auditLog. ----

  private async loadAgroWorkspace() {
    const rows = await this.databaseService.query<(RowDataPacket & { workspace_json: unknown })[]>(
      `SELECT workspace_json FROM saas_agro_workspaces WHERE tenant_id = ? AND workspace_key = 'public'`,
      [AGRO_TENANT_ID]
    );
    return this.parseJson(rows[0]?.workspace_json);
  }

  private async countAgro() {
    const data = await this.loadAgroWorkspace();
    if (!data) return 0;
    const { startMs, endMs } = epochRangeMs();
    const movements = Array.isArray(data.animalMovements) ? data.animalMovements : [];
    const altas = movements.filter((m: { id: string }) => {
      const epoch = extractEpoch(m.id);
      return epoch >= startMs && epoch < endMs;
    }).length;

    const auditLog = Array.isArray(data.auditLog) ? data.auditLog : [];
    const edits = auditLog.filter((e: { id: string; action: string }) => {
      const epoch = extractEpoch(e.id);
      return (e.action === "edit" || e.action === "delete") && epoch >= startMs && epoch < endMs;
    }).length;

    return altas + edits;
  }

  private async detailAgro(dayLabel?: string): Promise<MovimientosDetailItem[]> {
    const data = await this.loadAgroWorkspace();
    if (!data) return [];
    const { startMs, endMs } = epochRangeMs(dayLabel);

    const fieldsById: Record<string, string> = {};
    (data.fields || []).forEach((f: { id: string; name: string }) => (fieldsById[f.id] = f.name));
    const estById: Record<string, string> = {};
    (data.establishments || []).forEach((e: { id: string; name: string }) => (estById[e.id] = e.name));

    const items: MovimientosDetailItem[] = [];
    const movements = Array.isArray(data.animalMovements) ? data.animalMovements : [];
    for (const m of movements as Array<{
      id: string;
      kind: string;
      species: string;
      quantity: number;
      establishmentId: string;
      fieldId: string;
    }>) {
      const epoch = extractEpoch(m.id);
      if (epoch < startMs || epoch >= endMs) continue;
      const place = `${estById[m.establishmentId] || "?"} / ${fieldsById[m.fieldId] || "?"}`;
      items.push({
        time: new Date(epoch).toLocaleTimeString("es-UY", { timeZone: "America/Montevideo", hour: "2-digit", minute: "2-digit" }),
        label: AGRO_KIND_LABELS[m.kind] || m.kind,
        detail: `${place} · ${m.species} · cant. ${m.quantity}`
      });
    }

    const auditLog = Array.isArray(data.auditLog) ? data.auditLog : [];
    for (const e of auditLog as Array<{ id: string; action: string; movementId?: string }>) {
      const epoch = extractEpoch(e.id);
      if (epoch < startMs || epoch >= endMs) continue;
      if (e.action !== "edit" && e.action !== "delete") continue;
      items.push({
        time: new Date(epoch).toLocaleTimeString("es-UY", { timeZone: "America/Montevideo", hour: "2-digit", minute: "2-digit" }),
        label: e.action === "edit" ? "Edición" : "Borrado",
        detail: `Movimiento ${e.movementId || ""}`
      });
    }

    return items.sort((a, b) => b.time.localeCompare(a.time));
  }

  private parseJson(raw: unknown): any {
    if (!raw) return null;
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  }
}
