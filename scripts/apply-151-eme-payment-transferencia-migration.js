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
  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL });
  const [rows] = await connection.query(
    `SELECT COLUMN_TYPE AS t FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'saas_eme_orders' AND COLUMN_NAME = 'payment'`
  );
  if (String(rows[0].t).includes("transferencia")) {
    console.log("migration-151 ya estaba aplicada");
  } else {
    await connection.query(fs.readFileSync("db/migrations/151_saas_eme_payment_transferencia.sql", "utf8"));
    console.log("migration-151-ok");
  }
  await connection.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
