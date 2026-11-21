import { RowDataPacket } from "mysql2";
import { DatabaseService } from "../database/database.service";

// Resumen de visitas para el admin de cada tienda (21/11/2026): QQ y Ropa.
// Barato a proposito: 3 consultas agrupadas que van por el indice de fecha
// (occurred_at), solo cuando el admin abre la pestaña, y 60 s de cache. Nunca
// se mandan los registros crudos, solo los totales.
//
// occurred_at esta en UTC; Montevideo es UTC-3 todo el año.

const ALLOWED_TABLES = new Set(["saas_qq_audit_log", "saas_ropa_audit_log"]);
const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; value: VisitsSummary }>();

export type VisitsSummary = {
  days: number;
  people: number;
  views: number;
  carts: number;
  whatsapp: number;
  byDay: { day: string; people: number }[];
  topProducts: { label: string; views: number }[];
};

// Medianoche de Montevideo de hace (days - 1) dias, expresada en UTC.
function rangeStartUtc(days: number): string {
  const now = new Date();
  const local = new Date(now.getTime() - 3 * 3_600_000);
  const startLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - (days - 1));
  return new Date(startLocal + 3 * 3_600_000).toISOString().slice(0, 19).replace("T", " ");
}

export async function visitsSummary(databaseService: DatabaseService, table: string, days: number): Promise<VisitsSummary> {
  if (!ALLOWED_TABLES.has(table)) throw new Error("Tabla no permitida");
  const safeDays = [1, 7, 30].includes(days) ? days : 7;
  const key = table + ":" + safeDays;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  const since = rangeStartUtc(safeDays);
  const where = `entity_type = 'visitor' AND occurred_at >= ?`;

  const [totals, perDay, top] = await Promise.all([
    databaseService.query<(RowDataPacket & { action: string; n: number; people: number })[]>(
      `SELECT action, COUNT(*) AS n, COUNT(DISTINCT entity_id) AS people FROM ${table} WHERE ${where} GROUP BY action`,
      [since]
    ),
    databaseService.query<(RowDataPacket & { day: string; people: number })[]>(
      `SELECT DATE_FORMAT(DATE_SUB(occurred_at, INTERVAL 3 HOUR), '%Y-%m-%d') AS day, COUNT(DISTINCT entity_id) AS people
       FROM ${table} WHERE ${where} AND action = 'visit' GROUP BY day ORDER BY day`,
      [since]
    ),
    databaseService.query<(RowDataPacket & { label: string; n: number })[]>(
      `SELECT entity_label AS label, COUNT(*) AS n FROM ${table}
       WHERE ${where} AND action = 'view_product' AND entity_label IS NOT NULL
       GROUP BY entity_label ORDER BY n DESC LIMIT 5`,
      [since]
    )
  ]);

  const count = (action: string) => Number(totals.find((row) => row.action === action)?.n ?? 0);
  const value: VisitsSummary = {
    days: safeDays,
    people: Number(totals.find((row) => row.action === "visit")?.people ?? 0),
    views: count("view_product"),
    carts: count("add_to_cart"),
    whatsapp: count("whatsapp_click"),
    byDay: perDay.map((row) => ({ day: row.day, people: Number(row.people) })),
    topProducts: top.map((row) => ({ label: row.label, views: Number(row.n) }))
  };
  cache.set(key, { at: Date.now(), value });
  return value;
}
