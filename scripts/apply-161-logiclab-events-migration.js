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

async function main() {
  loadEnvFile();
  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL, multipleStatements: true });
  const count = async () => (await connection.query("SELECT event, COUNT(*) n FROM saas_logiclab_events GROUP BY event ORDER BY event"))[0];
  const before = JSON.stringify(await count());
  await connection.query(fs.readFileSync("db/migrations/161_saas_logiclab_events_recorrido.sql", "utf8"));
  const after = JSON.stringify(await count());
  const [[column]] = await connection.query("SHOW COLUMNS FROM saas_logiclab_events LIKE 'event'");
  await connection.end();
  if (before !== after) throw new Error(`Los datos cambiaron: ${before} -> ${after}`);
  console.log("migration-161-ok", after, column.Type);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
