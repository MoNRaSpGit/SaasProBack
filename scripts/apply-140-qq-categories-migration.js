const fs = require("fs");
const mysql = require("mysql2/promise");

function loadEnvFile() {
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    if (key && !(key in process.env)) process.env[key] = line.slice(idx + 1).trim();
  }
}

async function main() {
  loadEnvFile();
  const sql = fs.readFileSync("db/migrations/140_saas_qq_categories.sql", "utf8");
  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL, multipleStatements: true });
  await connection.query(sql);
  await connection.end();
  console.log("migration-140-ok (la lista inicial se carga sola al primer pedido)");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
