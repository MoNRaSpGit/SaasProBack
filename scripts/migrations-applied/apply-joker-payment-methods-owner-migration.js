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
  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL, multipleStatements: true });

  const [columns] = await connection.query(
    `SELECT COUNT(*) AS count FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'saas_joker_payment_methods' AND column_name = 'owner_name'`
  );
  if (columns[0].count > 0) {
    console.log("migration-091-already-applied");
    await connection.end();
    return;
  }

  const sql = fs.readFileSync("db/migrations/091_saas_joker_payment_methods_owner.sql", "utf8");
  await connection.query(sql);
  await connection.end();
  console.log("migration-091-ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
