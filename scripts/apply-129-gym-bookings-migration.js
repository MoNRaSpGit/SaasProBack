// Aplica la migracion 129 y crea (si no existe) el link publico de turnos
// para el workspace 'public' (el de Ale). Imprime el token.
const fs = require("fs");
const crypto = require("crypto");
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
  const sql = fs.readFileSync("db/migrations/129_saas_gym_bookings.sql", "utf8");
  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL, multipleStatements: true });
  await connection.query(sql);
  const token = crypto.randomBytes(16).toString("hex");
  await connection.query("INSERT IGNORE INTO saas_gym_booking_links (workspace_key, public_token) VALUES ('public', ?)", [token]);
  const [rows] = await connection.query("SELECT public_token FROM saas_gym_booking_links WHERE workspace_key = 'public'");
  await connection.end();
  console.log("migration-129-ok token=" + rows[0].public_token);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
