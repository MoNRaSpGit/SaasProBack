// Aplica la migracion 160 (cuenta corriente de Piloto con historial).
// Antes de tocar nada guarda una copia de clientes y boletas en
// scratch_backups/ (ignorado por git) y al final comprueba que no cambio
// ningun saldo.
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

async function snapshot(connection) {
  const [clients] = await connection.query("SELECT id, name, phone, address, created_at FROM saas_piloto_clients ORDER BY id");
  const [entries] = await connection.query(
    "SELECT id, client_id, sale_id, total, items, created_at FROM saas_piloto_account_entries ORDER BY id"
  );
  return { clients, entries };
}

async function main() {
  loadEnvFile();
  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL, multipleStatements: true });

  const before = await snapshot(connection);
  fs.mkdirSync("scratch_backups", { recursive: true });
  const file = `scratch_backups/piloto-cuentas-antes-160-${Date.now()}.json`;
  fs.writeFileSync(file, JSON.stringify(before, null, 2));
  console.log("respaldo:", file, `(${before.clients.length} clientes, ${before.entries.length} boletas)`);

  await connection.query(fs.readFileSync("db/migrations/160_saas_piloto_account_ledger.sql", "utf8"));

  const after = await snapshot(connection);
  await connection.end();
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new Error("Los datos cambiaron durante la migracion: revisar contra el respaldo.");
  }
  console.log("migration-160-ok (clientes y boletas identicos)");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
