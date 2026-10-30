// Visitas y recorrido de los visitantes de frontend-qq (30/10/2026, pedido
// explicito: "entraron 10 personas hoy... donde se frenan"). Solo lee.
//
// Uso: node scripts/inspect-qq-visits.js [desde YYYY-MM-DD] [hasta YYYY-MM-DD]
// Sin fechas: los ultimos 7 dias (hora de Montevideo).
//
// Cada "visitante" es una apertura de la pagina (id al azar que vive solo
// mientras la pagina esta abierta, sin cookies -- ver frontend-qq/qq.track.ts),
// asi que recargar cuenta como otra visita. El administrador no se cuenta.
// Los ids que empiezan con "test-" son pruebas nuestras y se ignoran.
// Fechas: occurred_at esta en UTC; se pasa a Montevideo (UTC-3) en el SQL y
// los limites se mandan como texto (mismo criterio que check-qq-activity.js).

const fs = require("fs");
const mysql = require("mysql2/promise");

function loadEnvFile() {
  const envText = fs.readFileSync(".env", "utf8");
  for (const line of envText.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    if (key && !(key in process.env)) process.env[key] = line.slice(idx + 1).trim();
  }
}

function mvdToday() {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

function addDays(day, n) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const EVENTS = ["visit", "view_product", "add_to_cart", "open_cart", "whatsapp_click"];

async function main() {
  loadEnvFile();
  const to = process.argv[3] || mvdToday();
  const from = process.argv[2] || addDays(to, -6);
  const fromUtc = `${from} 03:00:00`;
  const toUtc = `${addDays(to, 1)} 03:00:00`;
  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL });

  const [rows] = await connection.query(
    `SELECT DATE_FORMAT(DATE_SUB(occurred_at, INTERVAL 3 HOUR), '%Y-%m-%d %H:%i') AS at, action, entity_id AS visitor, entity_label AS label
     FROM saas_qq_audit_log
     WHERE entity_type = 'visitor' AND entity_id NOT LIKE 'test-%' AND occurred_at >= ? AND occurred_at < ?
     ORDER BY occurred_at`,
    [fromUtc, toUtc]
  );
  await connection.end();

  console.log(`QQ -- visitantes del ${from} al ${to} (sin el administrador)\n`);
  if (!rows.length) {
    console.log("Sin visitas registradas en ese rango.");
    return;
  }

  // Por dia: visitas y cuantas llegaron a cada paso.
  const byDay = new Map();
  for (const r of rows) {
    const day = r.at.slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, Object.fromEntries(EVENTS.map((e) => [e, new Set()])));
    byDay.get(day)[r.action]?.add(r.visitor);
  }
  console.log("Dia         visitas  abrieron tarjeta  agregaron al carrito  fueron a WhatsApp");
  for (const [day, s] of [...byDay].sort()) {
    console.log(`${day}  ${String(s.visit.size).padStart(7)}  ${String(s.view_product.size).padStart(16)}  ${String(s.add_to_cart.size).padStart(20)}  ${String(s.whatsapp_click.size).padStart(17)}`);
  }

  // Embudo del rango completo (visitantes distintos que llegaron a cada paso).
  const reached = Object.fromEntries(EVENTS.map((e) => [e, new Set(rows.filter((r) => r.action === e).map((r) => r.visitor))]));
  const total = reached.visit.size || 1;
  console.log("\nEmbudo (visitantes distintos):");
  for (const [e, name] of [
    ["visit", "Entraron"],
    ["view_product", "Abrieron una tarjeta"],
    ["add_to_cart", "Agregaron al carrito"],
    ["open_cart", "Abrieron el carrito"],
    ["whatsapp_click", "Fueron a WhatsApp"],
  ]) {
    console.log(`  ${name.padEnd(22)} ${String(reached[e].size).padStart(4)}  (${Math.round((reached[e].size / total) * 100)}%)`);
  }

  // Lo mas mirado y lo mas agregado.
  const count = (action) => {
    const m = new Map();
    for (const r of rows.filter((x) => x.action === action)) {
      const key = action === "add_to_cart" ? (r.label || "?").replace(/ \(.*$/, "") : r.label || "?";
      m.set(key, (m.get(key) || 0) + 1);
    }
    return [...m].sort((a, b) => b[1] - a[1]).slice(0, 8);
  };
  console.log("\nTarjetas mas abiertas:");
  for (const [name, n] of count("view_product")) console.log(`  ${String(n).padStart(4)}  ${name}`);
  console.log("\nMas agregados al carrito:");
  for (const [name, n] of count("add_to_cart")) console.log(`  ${String(n).padStart(4)}  ${name}`);

  // Horas pico de visitas.
  const hours = new Map();
  for (const r of rows.filter((x) => x.action === "visit")) {
    const h = r.at.slice(11, 13);
    hours.set(h, (hours.get(h) || 0) + 1);
  }
  console.log("\nHoras con mas visitas:", [...hours].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([h, n]) => `${h} hs (${n})`).join(", "));

  // Recorrido de las ultimas visitas que hicieron algo mas que entrar.
  const journeys = new Map();
  for (const r of rows) {
    if (!journeys.has(r.visitor)) journeys.set(r.visitor, []);
    journeys.get(r.visitor).push(r);
  }
  const NAMES = { visit: "entró", view_product: "abrió", add_to_cart: "agregó", open_cart: "abrió el carrito", whatsapp_click: "fue a WhatsApp" };
  const active = [...journeys.values()].filter((j) => j.length > 1).slice(-10);
  console.log(`\nRecorrido de las ultimas ${active.length} visitas que hicieron algo (de ${journeys.size}):`);
  for (const j of active) {
    const steps = j.map((r) => `${NAMES[r.action] || r.action}${r.label ? ` "${r.label}"` : ""}`).join(" -> ");
    const end = j[j.length - 1].action === "whatsapp_click" ? "" : "  [se fue sin escribir]";
    console.log(`  ${j[0].at}  ${steps}${end}`);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
