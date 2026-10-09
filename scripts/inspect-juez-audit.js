// Consulta el registro de auditoria de Juez (tabla saas_juez_audit_log,
// ver src/modules/juez/audit/juez-audit.service.ts) -- PARA NOSOTROS: no
// hay pantalla en la app que lo muestre. Responde a "se loguean,
// actualizan algo, agregan jugadores" (pedido explicito, 10/10/2026):
// login, alta de equipo, alta/edicion de jugador (con el detalle de que
// cambio en la edicion).
//
// Uso:
//   node scripts/inspect-juez-audit.js                 -> ultimas 50
//   node scripts/inspect-juez-audit.js --limit=200
//   node scripts/inspect-juez-audit.js --action=login
//   node scripts/inspect-juez-audit.js --actor=admin
//
// Solo lee.
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
  login: "LOGIN",
  player_created: "ALTA JUGADOR",
  player_updated: "EDICION JUGADOR",
  team_created: "ALTA EQUIPO"
};

async function main() {
  loadEnvFile();

  const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
  const actionArg = process.argv.find((arg) => arg.startsWith("--action="));
  const actorArg = process.argv.find((arg) => arg.startsWith("--actor="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : 50;

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306
  });

  const [rows] = await conn.execute(
    `SELECT id, action, actor, details, created_at
     FROM saas_juez_audit_log
     ORDER BY created_at DESC, id DESC
     LIMIT ${Number.isFinite(limit) ? limit : 50}`
  );
  await conn.end();

  const filtered = rows.filter((row) => {
    if (actionArg && row.action !== actionArg.split("=")[1]) return false;
    if (actorArg && row.actor !== actorArg.split("=")[1]) return false;
    return true;
  });

  console.log(`=== Auditoria Juez (${filtered.length} de ${rows.length} entrada(s)) ===\n`);

  if (!filtered.length) {
    console.log("Nada para mostrar con ese filtro.");
    return;
  }

  for (const row of filtered) {
    const when = new Date(row.created_at).toLocaleString("es-UY", { timeZone: "America/Montevideo" });
    const label = ACTION_LABELS[row.action] || row.action.toUpperCase();
    console.log(`[${when}] ${label} -- ${row.actor}`);
    console.log(`  ${row.details}`);
    console.log("");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
