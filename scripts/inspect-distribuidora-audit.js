// Consulta la auditoria de frontend-distribuidora (tabla
// saas_distribuidora_audit_log, migracion 109) -- PARA NOSOTROS: no hay
// pantalla en la app que la muestre. Responde a "que paso en la
// distribuidora": pedidos tomados, editados y eliminados, boletas
// generadas, altas y cambios de productos, altas de clientes.
//
// Uso:
//   node scripts/inspect-distribuidora-audit.js               -> hoy (hora Montevideo)
//   node scripts/inspect-distribuidora-audit.js 2026-10-09    -> ese dia
//   node scripts/inspect-distribuidora-audit.js --days=7      -> ultimos 7 dias
//   ... --full   -> en los borrados, muestra tambien el pedido entero en JSON
//
// Solo lee. No hay login: "quien" es el dispositivo (un id que genera el
// navegador + tipo de equipo). Un pedido o boleta ELIMINADO queda entero
// en before_json -- es la unica copia; con --full se puede recuperar.
//
// Zona horaria: occurred_at se guarda en UTC; se trae con DATE_FORMAT
// (string crudo) y se le agrega "Z" a mano -- mysql2 NO debe construir el
// Date (bug de +3hs encontrado el 18/09/2026, ver check-oriol-activity.js).
const fs = require("fs");
const mysql = require("mysql2/promise");

function loadEnvFile() {
  const envText = fs.readFileSync(".env", "utf8");
  for (const line of envText.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key && !(key in process.env)) process.env[key] = value;
  }
}

const TZ = "America/Montevideo";

const ACTION_LABELS = {
  order_create: "PEDIDO NUEVO",
  order_update: "PEDIDO EDITADO",
  order_delete: "ELIMINADO",
  order_invoice: "BOLETA GENERADA",
  product_create: "ALTA PRODUCTO",
  product_update: "EDICION PRODUCTO",
  client_create: "ALTA CLIENTE"
};

function montevideoDay(date) {
  return date.toLocaleDateString("en-CA", { timeZone: TZ });
}

// Rango [00:00, 24:00) hora Montevideo, como strings UTC para el WHERE.
function dayRangeUtc(dayLabel, days = 1) {
  const start = new Date(`${dayLabel}T00:00:00-03:00`);
  const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
  const fmt = (d) => d.toISOString().slice(0, 19).replace("T", " ");
  return { start: fmt(start), end: fmt(end) };
}

function formatWhen(iso) {
  return new Date(iso).toLocaleString("es-UY", { timeZone: TZ, hourCycle: "h23" });
}

function describeDevice(deviceId, userAgent) {
  const ua = userAgent || "";
  const device = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "PC Windows"
          : /Macintosh/.test(ua)
            ? "Mac"
            : ua
              ? "otro equipo"
              : "equipo desconocido";
  return `${device}${deviceId ? ` #${deviceId.slice(0, 6)}` : " (sin id: app sin actualizar o prueba directa)"}`;
}

function parseJson(value) {
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? JSON.parse(value) : value;
}

function itemLine(item) {
  return `${item.quantity}x ${item.name} ($${item.price})`;
}

// Que cambio entre el pedido de antes y el de despues, renglon por renglon.
function describeOrderChanges(before, after) {
  const lines = [];
  const beforeById = new Map(before.items.map((item) => [item.productId, item]));
  const afterById = new Map(after.items.map((item) => [item.productId, item]));
  for (const item of after.items) {
    const previous = beforeById.get(item.productId);
    if (!previous) lines.push(`+ agregado: ${itemLine(item)}`);
    else if (previous.quantity !== item.quantity) lines.push(`~ ${item.name}: ${previous.quantity} -> ${item.quantity}`);
  }
  for (const item of before.items) {
    if (!afterById.has(item.productId)) lines.push(`- sacado: ${itemLine(item)}`);
  }
  if ((before.note || "") !== (after.note || "")) lines.push(`~ nota: "${before.note || ""}" -> "${after.note || ""}"`);
  return lines;
}

async function main() {
  loadEnvFile();
  const args = process.argv.slice(2);
  const full = args.includes("--full");
  const daysArg = args.find((arg) => arg.startsWith("--days="));
  const dayArg = args.find((arg) => /^\d{4}-\d{2}-\d{2}$/.test(arg));

  let label;
  let range;
  if (daysArg) {
    const days = Math.max(1, Number(daysArg.split("=")[1]) || 1);
    const today = montevideoDay(new Date());
    const startDay = montevideoDay(new Date(new Date(`${today}T12:00:00-03:00`).getTime() - (days - 1) * 86400000));
    range = dayRangeUtc(startDay, days);
    label = `ultimos ${days} dia(s)`;
  } else {
    const day = dayArg || montevideoDay(new Date());
    range = dayRangeUtc(day);
    label = day;
  }

  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL });
  let rows;
  try {
    [rows] = await connection.query(
      `SELECT id, DATE_FORMAT(occurred_at, '%Y-%m-%dT%H:%i:%sZ') AS occurred_at, action, entity_id, summary,
              before_json, after_json, device_id, user_agent
       FROM saas_distribuidora_audit_log
       WHERE occurred_at >= ? AND occurred_at < ?
       ORDER BY occurred_at ASC, id ASC`,
      [range.start, range.end]
    );
  } finally {
    await connection.end();
  }

  console.log(`Auditoria de frontend-distribuidora -- ${label} (hora Montevideo)`);
  console.log("=".repeat(100));
  if (rows.length === 0) {
    console.log("Sin movimientos registrados en ese periodo.");
    return;
  }
  console.log(`${rows.length} registro(s)\n`);

  const counts = {};
  for (const row of rows) {
    counts[row.action] = (counts[row.action] || 0) + 1;
    const before = parseJson(row.before_json);
    const after = parseJson(row.after_json);

    console.log(
      `${formatWhen(row.occurred_at)} | ${ACTION_LABELS[row.action] || row.action} | ${row.summary} | ${describeDevice(row.device_id, row.user_agent)}`
    );

    if (row.action === "order_create" && after) {
      console.log(`    ${after.items.map(itemLine).join("; ")}${after.note ? ` | nota: "${after.note}"` : ""}`);
    } else if (row.action === "order_update" && before && after) {
      for (const line of describeOrderChanges(before, after)) console.log(`    ${line}`);
    } else if (row.action === "order_delete" && before) {
      console.log(`    tenia: ${before.items.map(itemLine).join("; ")}${before.note ? ` | nota: "${before.note}"` : ""}`);
      if (full) console.log(`    copia completa: ${JSON.stringify(before)}`);
    } else if (row.action === "client_create" && after) {
      const extra = [after.address, after.phone, after.rut ? `RUT ${after.rut}` : null].filter(Boolean).join(" · ");
      if (extra) console.log(`    ${extra}`);
    }
  }

  console.log("\n" + "-".repeat(100));
  console.log(
    Object.entries(counts)
      .map(([action, count]) => `${ACTION_LABELS[action] || action}: ${count}`)
      .join(" | ")
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
