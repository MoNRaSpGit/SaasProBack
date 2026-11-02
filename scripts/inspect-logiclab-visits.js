// Visitas de frontend-logiclab (02/11/2026, pedido explicito: contador
// propio en vez de GoatCounter). Solo lee.
//
// Uso: node scripts/inspect-logiclab-visits.js [desde YYYY-MM-DD] [hasta YYYY-MM-DD]
// Sin fechas: los ultimos 7 dias (hora de Montevideo).
//
// visitor_hash es un hash con sal de la IP (nunca la IP tal cual): se usa
// solo para aproximar visitantes unicos por dia. Fechas: occurred_at esta
// en UTC; se pasa a Montevideo (UTC-3) igual que inspect-qq-visits.js.

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

async function main() {
  loadEnvFile();
  const to = process.argv[3] || mvdToday();
  const from = process.argv[2] || addDays(to, -6);
  const fromUtc = `${from} 03:00:00`;
  const toUtc = `${addDays(to, 1)} 03:00:00`;
  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL });

  const [rows] = await connection.query(
    `SELECT DATE_FORMAT(DATE_SUB(occurred_at, INTERVAL 3 HOUR), '%Y-%m-%d') AS day,
            event, rubro, section, plan, src, visitor_hash
     FROM saas_logiclab_events
     WHERE occurred_at >= ? AND occurred_at < ?
     ORDER BY occurred_at`,
    [fromUtc, toUtc]
  );
  await connection.end();

  console.log(`Logic Lab -- visitas del ${from} al ${to}\n`);
  if (!rows.length) {
    console.log("Sin datos registrados en ese rango.");
    return;
  }

  // Por dia: visitas y unicos aproximados (por visitor_hash).
  const byDay = new Map();
  for (const r of rows) {
    if (!byDay.has(r.day)) byDay.set(r.day, { visits: 0, uniques: new Set() });
    if (r.event === "visit") {
      byDay.get(r.day).visits += 1;
      byDay.get(r.day).uniques.add(r.visitor_hash);
    }
  }
  console.log("Dia         visitas  unicos aprox.");
  for (const [day, s] of [...byDay].sort()) {
    console.log(`${day}  ${String(s.visits).padStart(7)}  ${String(s.uniques.size).padStart(13)}`);
  }

  // Origen (?src=).
  const origins = new Map();
  for (const r of rows.filter((x) => x.event === "visit")) {
    const key = r.src || "directo";
    origins.set(key, (origins.get(key) || 0) + 1);
  }
  console.log("\nOrigen de las visitas:");
  for (const [src, n] of [...origins].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${src}`);

  // Videos vistos por rubro.
  const videos = new Map();
  for (const r of rows.filter((x) => x.event === "ver_video")) {
    videos.set(r.rubro || "?", (videos.get(r.rubro || "?") || 0) + 1);
  }
  console.log("\nVideos vistos por rubro:");
  for (const [rubro, n] of [...videos].sort((a, b) => b[1] - a[1])) console.log(`  ${rubro}: ${n}`);

  // Clics de WhatsApp por sección.
  const waClicks = new Map();
  for (const r of rows.filter((x) => x.event === "wa_click")) {
    const key = r.rubro ? `${r.section || "?"} (${r.rubro})` : r.section || "?";
    waClicks.set(key, (waClicks.get(key) || 0) + 1);
  }
  console.log("\nClics de WhatsApp por sección:");
  for (const [section, n] of [...waClicks].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${section}`);

  // Cotizador: aperturas y presupuestos enviados.
  const quoteOpens = rows.filter((x) => x.event === "cotizador_abrir").length;
  const quoteSends = rows.filter((x) => x.event === "cotizador_enviar");
  console.log(`\nCotizador: ${quoteOpens} aperturas, ${quoteSends.length} presupuestos enviados`);
  const sendsByRubroPlan = new Map();
  for (const r of quoteSends) {
    const key = `${r.rubro || "?"} - ${r.plan || "armado a medida"}`;
    sendsByRubroPlan.set(key, (sendsByRubroPlan.get(key) || 0) + 1);
  }
  for (const [key, n] of [...sendsByRubroPlan].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${key}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
