// Quien entro a frontend-taller y que hizo (boton "Entrar", sin usuario ni
// contrasena -- pedido explicito 21/10/2026: "es para ver cuando entro
// alguien... y si hizo un presupuesto"). Solo lectura.
//
// Uso:
//   node scripts/inspect-taller-access.js          -> ultimos 7 dias
//   node scripts/inspect-taller-access.js 30        -> ultimos 30 dias
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
const EVENT_LABELS = { entrada: "Entró a la app", presupuesto_generado: "Presupuesto generado" };

async function main() {
  loadEnvFile();
  const days = Number(process.argv[2]) || 7;

  const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL });
  const [rows] = await conn.execute(
    `SELECT event, detail, DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s') AS created_at
     FROM saas_taller_access_log
     WHERE created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)
     ORDER BY created_at DESC`,
    [days]
  );
  await conn.end();

  if (rows.length === 0) {
    console.log(`Sin actividad en los últimos ${days} días.`);
    return;
  }

  console.log(`Actividad de frontend-taller (últimos ${days} días):\n`);
  for (const row of rows) {
    const when = new Date(`${row.created_at}Z`).toLocaleString("es-UY", { timeZone: TZ, dateStyle: "short", timeStyle: "short" });
    const label = EVENT_LABELS[row.event] || row.event;
    console.log(`${when}  ${label}${row.detail ? " — " + row.detail : ""}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
