// Consulta quien (que rol) edito por ultima vez cada pedido de Joker, y
// cuando -- PARA NOSOTROS, no para el staff. El cliente pidio explicitamente
// que esto NO se muestre en ningun lado de la app (ni a Administrador ni a
// Usuario); esta es la unica forma de verlo, cuando el cliente pregunte
// "quien edito este pedido" y haga falta reconstruirlo.
//
// Uso:
//   node scripts/inspect-joker-order-edits.js                 -> todos los editados, mas recientes primero
//   node scripts/inspect-joker-order-edits.js --order=67       -> por numero de pedido (display_number)
//   node scripts/inspect-joker-order-edits.js --date=2026-08-28 -> pedidos con esa fecha (order_date), editados
//   node scripts/inspect-joker-order-edits.js --role=usuario    -> solo editados por ese rol
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

function loadEnvFile() {
  const envPath = path.join(__dirname, "..", ".env");
  const raw = fs.readFileSync(envPath, "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return env;
}

function arg(name) {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
}

async function main() {
  const orderNumber = arg("order");
  const dateFilter = arg("date");
  const roleFilter = arg("role");

  const env = loadEnvFile();
  const url = new URL(env.DATABASE_URL);
  const conn = await mysql.createConnection({
    host: url.hostname,
    port: url.port || 3306,
    user: url.username,
    password: url.password,
    database: url.pathname.replace("/", "")
  });

  const conditions = ["edited_by_role IS NOT NULL"];
  const params = [];
  if (orderNumber) {
    conditions.push("display_number = ?");
    params.push(Number(orderNumber));
  }
  if (dateFilter) {
    conditions.push("order_date = ?");
    params.push(dateFilter);
  }
  if (roleFilter) {
    conditions.push("edited_by_role = ?");
    params.push(roleFilter);
  }

  const [rows] = await conn.execute(
    `SELECT id, display_number, edited_by_role, edited_at, origin_role, total, customer_name, order_date, created_at
     FROM saas_joker_orders
     WHERE ${conditions.join(" AND ")}
     ORDER BY edited_at DESC
     LIMIT 200`,
    params
  );
  await conn.end();

  console.log(`=== Pedidos editados (${rows.length}) ===\n`);
  if (rows.length === 0) {
    console.log("Nada para mostrar con ese filtro.");
    return;
  }

  for (const row of rows) {
    const editedAt = row.edited_at ? new Date(row.edited_at).toLocaleString("es-UY", { timeZone: "America/Montevideo" }) : "-";
    const createdAt = new Date(row.created_at).toLocaleString("es-UY", { timeZone: "America/Montevideo" });
    console.log(
      `Pedido #${row.display_number ?? "-"} (id ${row.id}) | editado por: ${row.edited_by_role} el ${editedAt} | ` +
        `creado por: ${row.origin_role} el ${createdAt} | fecha del pedido: ${row.order_date ?? "-"} | ` +
        `total: ${row.total} | cliente: ${row.customer_name ?? "-"}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
