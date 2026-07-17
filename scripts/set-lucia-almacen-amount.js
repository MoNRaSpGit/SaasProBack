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
  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL });

  const [rows] = await connection.query(
    "SELECT id, name, amount, frequency, next_payment_at FROM saas_scrum_clients WHERE name = ? LIMIT 1",
    ["Lucia Almacen"]
  );
  if (!rows[0]) {
    throw new Error("No se encontro el cliente Lucia Almacen");
  }
  console.log("cliente encontrado:", rows[0]);

  await connection.execute("UPDATE saas_scrum_clients SET amount = ? WHERE id = ?", [3900, rows[0].id]);

  const [updated] = await connection.query(
    "SELECT id, name, amount, frequency, next_payment_at FROM saas_scrum_clients WHERE id = ?",
    [rows[0].id]
  );
  console.log("actualizado:", updated[0]);

  await connection.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
