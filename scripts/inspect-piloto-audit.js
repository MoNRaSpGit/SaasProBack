// Consulta el registro de auditoria de frontend-piloto (tabla
// saas_piloto_audit_log, ver db/migrations/092 y
// src/modules/piloto/piloto-audit.service.ts) -- PARA NOSOTROS: no hay
// pantalla en la app que lo muestre. Responde a "que paso en piloto":
// productos nuevos/editados (nombre, precio) y ventas (con su detalle de
// items). Piloto no tiene login, asi que no hay "quien" -- un solo
// operador con el POS.
//
// Uso:
//   node scripts/inspect-piloto-audit.js                 -> hoy (hora Montevideo)
//   node scripts/inspect-piloto-audit.js 2026-09-22      -> ese dia
//   node scripts/inspect-piloto-audit.js --days=7        -> ultimos 7 dias
//   ... [--entity=product|sale] [--action=create|update|sale]
//
// Solo lee. Zona horaria: occurred_at se guarda en UTC; se trae con
// DATE_FORMAT (string crudo) y se le agrega "Z" a mano -- mysql2 NO debe
// construir el Date (bug de +3hs encontrado el 18/09/2026, ver
// scripts/check-oriol-activity.js).
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

function loadEnvFile() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    if (key && !(key in process.env)) process.env[key] = line.slice(idx + 1).trim();
  }
}

const ACTION_LABELS = {
  create: "ALTA",
  update: "EDICION",
  sale: "VENTA"
};

const ENTITY_LABELS = {
  product: "Producto",
  sale: "Venta"
};

const FIELD_LABELS = {
  name: "nombre",
  price: "precio"
};

function montevideoDay(date) {
  return date.toLocaleDateString("en-CA", { timeZone: "America/Montevideo" });
}

// Rango [00:00, 24:00) hora Montevideo de un dia, como strings UTC-naive.
function dayRangeUtc(dayLabel, days = 1) {
  const start = new Date(`${dayLabel}T00:00:00-03:00`);
  const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
  const fmt = (d) => d.toISOString().slice(0, 19).replace("T", " ");
  return { start: fmt(start), end: fmt(end) };
}

function formatWhen(raw) {
  return new Date(`${raw}Z`).toLocaleString("es-UY", { timeZone: "America/Montevideo" });
}

function summarizeDetails(row) {
  if (!row.details) return "";
  let d;
  try {
    d = JSON.parse(row.details);
  } catch {
    return row.details;
  }
  if (d.changes) {
    return Object.entries(d.changes)
      .map(([field, [from, to]]) => `${FIELD_LABELS[field] || field}: ${from ?? "(vacio)"} -> ${to ?? "(vacio)"}`)
      .join("; ");
  }
  if (Array.isArray(d.items)) {
    // Venta: detalle del carrito + medio de pago y total.
    const itemsText = d.items.map((item) => `${item.quantity}x ${item.name} ($${item.price})`).join("; ");
    return `${d.paymentMethod} | total $${d.totalAmount} (${d.itemsCount} items) | ${itemsText}`;
  }
  const parts = [];
  if (d.barcode) parts.push(`codigo ${d.barcode}`);
  if (d.price != null) parts.push(`$${d.price}`);
  if (d.stock != null) parts.push(`stock ${d.stock}`);
  if (d.status) parts.push(d.status);
  return parts.join(", ");
}

async function main() {
  const args = process.argv.slice(2);
  const daysArg = args.find((a) => a.startsWith("--days="))?.split("=")[1];
  const entity = args.find((a) => a.startsWith("--entity="))?.split("=")[1];
  const action = args.find((a) => a.startsWith("--action="))?.split("=")[1];
  const dayArg = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));

  let start;
  let end;
  let title;
  if (daysArg) {
    const days = Number(daysArg);
    const today = montevideoDay(new Date());
    const firstDay = montevideoDay(new Date(new Date(`${today}T00:00:00-03:00`).getTime() - (days - 1) * 24 * 60 * 60 * 1000));
    ({ start, end } = { start: dayRangeUtc(firstDay).start, end: dayRangeUtc(today).end });
    title = `ultimos ${days} dia(s) (desde ${firstDay})`;
  } else {
    const day = dayArg || montevideoDay(new Date());
    ({ start, end } = dayRangeUtc(day));
    title = day;
  }

  loadEnvFile();
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const filters = ["occurred_at >= ?", "occurred_at < ?"];
  const params = [start, end];
  if (entity) {
    filters.push("entity_type = ?");
    params.push(entity);
  }
  if (action) {
    filters.push("action = ?");
    params.push(action);
  }
  const [rows] = await conn.query(
    `SELECT id, DATE_FORMAT(occurred_at, '%Y-%m-%dT%H:%i:%s') AS occurred_at, action, entity_type, entity_id, entity_label, details
     FROM saas_piloto_audit_log WHERE ${filters.join(" AND ")} ORDER BY occurred_at ASC, id ASC`,
    params
  );
  await conn.end();

  console.log(`Auditoria de frontend-piloto -- ${title} (hora Montevideo)${entity ? ` | entidad=${entity}` : ""}${action ? ` | accion=${action}` : ""}`);
  console.log("=".repeat(100));
  if (!rows.length) {
    console.log("Sin registros para ese filtro.");
    console.log("(La auditoria empezo a registrar el 22/09/2026: no hay historial anterior a esa fecha.)");
    return;
  }
  console.log(`${rows.length} registro(s)\n`);
  for (const row of rows) {
    const detail = summarizeDetails(row);
    console.log(
      `${formatWhen(row.occurred_at)} | ${ACTION_LABELS[row.action] || row.action} | ${ENTITY_LABELS[row.entity_type] || row.entity_type}` +
        `${row.entity_label ? ` "${row.entity_label}"` : ""}${row.entity_id ? ` [#${row.entity_id}]` : ""}${detail ? `\n    ${detail}` : ""}`
    );
  }

  const sales = rows.filter((row) => row.action === "sale");
  if (sales.length) {
    let total = 0;
    let itemsCount = 0;
    for (const row of sales) {
      try {
        const d = JSON.parse(row.details || "{}");
        total += Number(d.totalAmount) || 0;
        itemsCount += Number(d.itemsCount) || 0;
      } catch {
        // detalle ilegible: se cuenta la venta igual, sin sumar importes.
      }
    }
    console.log("\n" + "-".repeat(100));
    console.log(`Ventas: ${sales.length}, ${itemsCount} item(s) en total, $${total.toFixed(2)} en total`);
  }
}

main().catch((error) => {
  console.error("Error consultando la auditoria de piloto:", error);
  process.exitCode = 1;
});
