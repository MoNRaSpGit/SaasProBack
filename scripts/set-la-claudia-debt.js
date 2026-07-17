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

  const [rows] = await connection.query("SELECT id, name, debt_amount FROM saas_scrum_clients WHERE name = ? LIMIT 1", [
    "La Claudia"
  ]);
  if (!rows[0]) {
    throw new Error("No se encontro el cliente La Claudia");
  }
  const clientId = rows[0].id;
  console.log("cliente encontrado:", rows[0]);

  await connection.execute("UPDATE saas_scrum_clients SET debt_amount = ? WHERE id = ?", [4000, clientId]);

  const [existingPayments] = await connection.query("SELECT id, amount FROM saas_scrum_client_debt_payments WHERE client_id = ?", [
    clientId
  ]);
  if (existingPayments.length === 0) {
    await connection.execute("INSERT INTO saas_scrum_client_debt_payments (client_id, amount) VALUES (?, ?)", [clientId, 500]);
    console.log("pago de 500 registrado");
  } else {
    console.log("ya existian pagos, no se inserta de nuevo:", existingPayments);
  }

  await connection.end();
  console.log("listo");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
