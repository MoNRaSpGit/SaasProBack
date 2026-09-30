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
  const limit = Number(process.argv[2]) || 20;
  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL });
  const [rows] = await connection.query(
    `SELECT id, tenant_id, user_agent, transcript, raw_results_json, created_at
     FROM saas_agro_voice_debug_logs
     ORDER BY id DESC
     LIMIT ?`,
    [limit]
  );
  await connection.end();

  for (const row of rows) {
    console.log("----------------------------------------");
    console.log(`id=${row.id} tenant=${row.tenant_id} created_at=${row.created_at}`);
    console.log(`user_agent: ${row.user_agent}`);
    console.log(`transcript final: "${row.transcript}"`);
    console.log("raw_results:");
    const raw = typeof row.raw_results_json === "string" ? JSON.parse(row.raw_results_json) : row.raw_results_json;
    for (const entry of raw || []) {
      console.log(`  [${entry.index}] final=${entry.isFinal} "${entry.text}"`);
    }
  }
  console.log("----------------------------------------");
  console.log(`total mostrado: ${rows.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
