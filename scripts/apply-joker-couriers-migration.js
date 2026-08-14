const fs = require("fs");
const mysql = require("mysql2/promise");

function loadEnvFile() {
  const envText = fs.readFileSync(".env", "utf8");

  for (const line of envText.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

async function main() {
  loadEnvFile();

  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL, multipleStatements: true });

  const sql051 = fs.readFileSync("db/migrations/051_saas_joker_couriers.sql", "utf8");
  await connection.query(sql051);
  console.log("migration-051-ok");

  const sql052 = fs.readFileSync("db/migrations/052_saas_joker_orders_courier.sql", "utf8");
  await connection.query(sql052);
  console.log("migration-052-ok");

  await connection.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
