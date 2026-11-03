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

  const sql = fs.readFileSync("db/migrations/028_saas_agro_workspaces_row_version.sql", "utf8");
  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL, multipleStatements: true });

  await connection.query(sql);

  const [columns] = await connection.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'saas_agro_workspaces' AND COLUMN_NAME = 'row_version'`
  );

  if (columns.length === 0) {
    await connection.query(
      `ALTER TABLE saas_agro_workspaces ADD COLUMN row_version BIGINT UNSIGNED NOT NULL DEFAULT 1`
    );
    console.log("migration-028-ok (columna row_version agregada)");
  } else {
    console.log("migration-028-ok (columna row_version ya existia)");
  }

  await connection.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
