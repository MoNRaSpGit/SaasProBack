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

async function hasColumn(connection, tableName, columnName) {
  const [rows] = await connection.query(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [tableName, columnName]
  );

  return rows.length > 0;
}

async function main() {
  loadEnvFile();

  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL, multipleStatements: true });

  try {
    await connection.beginTransaction();

    if (!(await hasColumn(connection, "saas_camiones_trips", "collected_amount"))) {
      await connection.query(
        `ALTER TABLE saas_camiones_trips
         ADD COLUMN collected_amount DECIMAL(10, 2) NULL AFTER status`
      );
    }

    await connection.query(
      `ALTER TABLE saas_camiones_trips
       MODIFY COLUMN status ENUM('confirmed', 'pending', 'paid', 'cancelled') NOT NULL DEFAULT 'confirmed'`
    );

    await connection.query(
      `UPDATE saas_camiones_trips
       SET status = 'confirmed'
       WHERE status = 'pending'`
    );

    await connection.commit();
    console.log("migration-017-ok");
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
