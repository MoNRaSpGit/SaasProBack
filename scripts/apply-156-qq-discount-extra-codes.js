// Agrega la columna extra_codes a la config de descuentos de QQ (migracion 156).
// Idempotente: si la columna ya existe no hace nada. No borra ni cambia datos.
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
  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL, multipleStatements: true });
  try {
    const [cols] = await connection.query(
      "SELECT COUNT(*) n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'saas_qq_discount_config' AND COLUMN_NAME = 'extra_codes'"
    );
    if (Number(cols[0].n) > 0) return console.log("ya estaba aplicado");
    await connection.query(fs.readFileSync("db/migrations/156_saas_qq_discount_extra_codes.sql", "utf8"));
    console.log("aplicado");
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
