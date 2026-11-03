// Deja fijo el esquema de Scrum en produccion y permite sacar el chequeo
// en caliente que corria en cada arranque del backend (03/11/2026, pedido
// explicito: "el proyecto Scrum... tiene como que una demora bastante
// extraña" -- la demora era el ensureTables()/createTables() de
// scrum.service.ts corriendo 7 CREATE TABLE + 6 chequeos de columnas +
// hasta 7 ALTER TABLE, todo en serie, en la primera request de Scrum
// despues de cada reinicio del backend compartido). Es exactamente la
// misma logica que tenia el runtime, corrida una sola vez a mano. Uso
// puntual, no hace falta volver a correrlo.
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

async function columnExists(conn, table, column) {
  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS total
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND column_name = ?`,
    [table, column]
  );
  return Number(rows[0]?.total || 0) > 0;
}

async function main() {
  loadEnvFile();
  const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL });

  await conn.execute(`DROP TABLE IF EXISTS saas_scrum_samples`);

  await conn.execute(
    `CREATE TABLE IF NOT EXISTS saas_scrum_tasks (
       id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
       title VARCHAR(180) NOT NULL,
       description VARCHAR(500) NULL,
       estimated_minutes INT UNSIGNED NOT NULL,
       duration_unit ENUM('days', 'weeks', 'months') NOT NULL DEFAULT 'days',
       duration_value INT UNSIGNED NOT NULL DEFAULT 1,
       difficulty ENUM('green', 'yellow', 'red', 'blue') NOT NULL,
       daily_task_key VARCHAR(80) NULL,
       task_day DATE NOT NULL,
       status ENUM('todo', 'in_progress', 'done') NOT NULL DEFAULT 'todo',
       started_at DATETIME NULL,
       completed_at DATETIME NULL,
       created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
       updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
       PRIMARY KEY (id)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  if (!(await columnExists(conn, "saas_scrum_tasks", "description"))) {
    await conn.execute(`ALTER TABLE saas_scrum_tasks ADD COLUMN description VARCHAR(500) NULL AFTER title`);
  }

  if (!(await columnExists(conn, "saas_scrum_tasks", "duration_unit"))) {
    await conn.execute(
      `ALTER TABLE saas_scrum_tasks ADD COLUMN duration_unit ENUM('days', 'weeks', 'months') NOT NULL DEFAULT 'days' AFTER estimated_minutes`
    );
  }

  if (!(await columnExists(conn, "saas_scrum_tasks", "duration_value"))) {
    await conn.execute(
      `ALTER TABLE saas_scrum_tasks ADD COLUMN duration_value INT UNSIGNED NOT NULL DEFAULT 1 AFTER duration_unit`
    );
  }

  if (!(await columnExists(conn, "saas_scrum_tasks", "daily_task_key"))) {
    await conn.execute(`ALTER TABLE saas_scrum_tasks ADD COLUMN daily_task_key VARCHAR(80) NULL AFTER difficulty`);
  }

  if (!(await columnExists(conn, "saas_scrum_tasks", "task_day"))) {
    await conn.execute(`ALTER TABLE saas_scrum_tasks ADD COLUMN task_day DATE NOT NULL DEFAULT '2026-07-06' AFTER daily_task_key`);
    await conn.execute(
      `UPDATE saas_scrum_tasks
       SET task_day = DATE(COALESCE(created_at, CURRENT_TIMESTAMP))
       WHERE task_day = '2026-07-06'`
    );
  }

  await conn.execute(`ALTER TABLE saas_scrum_tasks MODIFY COLUMN difficulty ENUM('green', 'yellow', 'red', 'blue') NOT NULL`);

  await conn.execute(
    `CREATE TABLE IF NOT EXISTS saas_scrum_clients (
       id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
       name VARCHAR(180) NOT NULL,
       amount DECIMAL(12, 2) NOT NULL,
       frequency ENUM('monthly', 'semiannual') NOT NULL,
       next_payment_at DATE NOT NULL,
       created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
       updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
       PRIMARY KEY (id)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  if (!(await columnExists(conn, "saas_scrum_clients", "debt_amount"))) {
    await conn.execute(`ALTER TABLE saas_scrum_clients ADD COLUMN debt_amount DECIMAL(12, 2) NULL AFTER frequency`);
  }

  await conn.execute(
    `CREATE TABLE IF NOT EXISTS saas_scrum_client_debt_payments (
       id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
       client_id BIGINT UNSIGNED NOT NULL,
       amount DECIMAL(12, 2) NOT NULL,
       paid_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (id),
       KEY idx_saas_scrum_client_debt_payments_client (client_id),
       CONSTRAINT fk_saas_scrum_client_debt_payments_client
         FOREIGN KEY (client_id) REFERENCES saas_scrum_clients (id)
         ON DELETE CASCADE
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  await conn.execute(
    `CREATE TABLE IF NOT EXISTS saas_scrum_client_amount_changes (
       id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
       client_id BIGINT UNSIGNED NOT NULL,
       previous_amount DECIMAL(12, 2) NOT NULL,
       new_amount DECIMAL(12, 2) NOT NULL,
       description VARCHAR(255) NOT NULL,
       changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (id),
       KEY idx_saas_scrum_client_amount_changes_client (client_id),
       CONSTRAINT fk_saas_scrum_client_amount_changes_client
         FOREIGN KEY (client_id) REFERENCES saas_scrum_clients (id)
         ON DELETE CASCADE
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  await conn.execute(
    `CREATE TABLE IF NOT EXISTS saas_scrum_debts (
       id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
       name VARCHAR(180) NOT NULL,
       initial_amount DECIMAL(12, 2) NOT NULL,
       due_date DATE NOT NULL,
       created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
       updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
       PRIMARY KEY (id)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  await conn.execute(
    `CREATE TABLE IF NOT EXISTS saas_scrum_debt_charges (
       id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
       debt_id BIGINT UNSIGNED NOT NULL,
       amount DECIMAL(12, 2) NOT NULL,
       detail VARCHAR(255) NOT NULL,
       charged_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (id),
       KEY idx_saas_scrum_debt_charges_debt (debt_id),
       CONSTRAINT fk_saas_scrum_debt_charges_debt
         FOREIGN KEY (debt_id) REFERENCES saas_scrum_debts (id)
         ON DELETE CASCADE
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  await conn.execute(
    `CREATE TABLE IF NOT EXISTS saas_scrum_debt_payments (
       id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
       debt_id BIGINT UNSIGNED NOT NULL,
       amount DECIMAL(12, 2) NOT NULL,
       paid_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (id),
       KEY idx_saas_scrum_debt_payments_debt (debt_id),
       CONSTRAINT fk_saas_scrum_debt_payments_debt
         FOREIGN KEY (debt_id) REFERENCES saas_scrum_debts (id)
         ON DELETE CASCADE
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  await conn.end();
  console.log("esquema de scrum finalizado");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
