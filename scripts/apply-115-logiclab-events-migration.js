// Crea la tabla de visitas de frontend-logiclab (migracion 115). Solo agrega
// una tabla nueva (CREATE TABLE IF NOT EXISTS): no toca datos existentes.
const fs = require("fs");
const mysql = require("mysql2/promise");

async function main() {
  require("dotenv").config({ quiet: true });
  const e = process.env;
  const connection = await mysql.createConnection(
    e.DATABASE_URL || {
      host: e.DB_HOST,
      port: Number(e.DB_PORT || 3306),
      user: e.DB_USER,
      password: e.DB_PASSWORD,
      database: e.DB_NAME,
      ssl: e.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined
    }
  );
  await connection.query(fs.readFileSync("db/migrations/115_saas_logiclab_events.sql", "utf8"));
  const [rows] = await connection.query("SELECT COUNT(*) AS total FROM saas_logiclab_events");
  console.log("Tabla saas_logiclab_events lista. Filas:", rows[0].total);
  await connection.end();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
