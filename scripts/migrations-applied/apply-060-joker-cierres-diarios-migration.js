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

  const sql = fs.readFileSync("db/migrations/060_saas_joker_cierres_diarios.sql", "utf8");
  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL, multipleStatements: true });
  await connection.query(sql);
  await connection.end();
  console.log("migration-060-ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
