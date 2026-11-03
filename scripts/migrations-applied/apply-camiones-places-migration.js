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

async function hasIndex(connection, tableName, indexName) {
  const [rows] = await connection.query(
    `SELECT INDEX_NAME
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND INDEX_NAME = ?
     LIMIT 1`,
    [tableName, indexName]
  );

  return rows.length > 0;
}

async function hasForeignKey(connection, tableName, constraintName) {
  const [rows] = await connection.query(
    `SELECT CONSTRAINT_NAME
     FROM information_schema.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND CONSTRAINT_TYPE = 'FOREIGN KEY'
       AND CONSTRAINT_NAME = ?
     LIMIT 1`,
    [tableName, constraintName]
  );

  return rows.length > 0;
}

async function main() {
  loadEnvFile();

  const sql = fs.readFileSync("db/migrations/007_saas_camiones_places.sql", "utf8");
  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL, multipleStatements: true });

  try {
    await connection.beginTransaction();
    await connection.query(sql);

    if (!(await hasColumn(connection, "saas_camiones_trips", "place_id"))) {
      await connection.query(
        `ALTER TABLE saas_camiones_trips
         ADD COLUMN place_id BIGINT UNSIGNED NULL AFTER client_id`
      );
    }

    if (!(await hasIndex(connection, "saas_camiones_trips", "idx_saas_camiones_trips_place"))) {
      await connection.query(
        `ALTER TABLE saas_camiones_trips
         ADD KEY idx_saas_camiones_trips_place (place_id)`
      );
    }

    if (!(await hasForeignKey(connection, "saas_camiones_trips", "fk_saas_camiones_trips_place"))) {
      await connection.query(
        `ALTER TABLE saas_camiones_trips
         ADD CONSTRAINT fk_saas_camiones_trips_place
         FOREIGN KEY (place_id) REFERENCES saas_camiones_places(id)
         ON DELETE RESTRICT`
      );
    }

    await connection.query(
      `UPDATE saas_camiones_trips t
       INNER JOIN saas_camiones_places p
         ON p.tenant_id = t.tenant_id
        AND p.name = t.place
       SET t.place_id = p.id
       WHERE t.place_id IS NULL`
    );

    await connection.commit();
    console.log("migration-007-ok");
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
