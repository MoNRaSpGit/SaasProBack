// Aplica la migracion 144 (peluqueria multi-local) y migra los datos que ya
// existian a una peluqueria "demo". Se puede correr mas de una vez.
const fs = require("fs");
const mysql = require("mysql2/promise");

function loadEnvFile() {
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    if (key && !(key in process.env)) process.env[key] = line.slice(idx + 1).trim();
  }
}

// Horario generico de arranque: lunes a sabado, 9 a 19, turnos de 1 hora.
const DEFAULT_SCHEDULE = {
  slotMinutes: 60,
  days: { 1: [["09:00", "19:00"]], 2: [["09:00", "19:00"]], 3: [["09:00", "19:00"]], 4: [["09:00", "19:00"]], 5: [["09:00", "19:00"]], 6: [["09:00", "19:00"]] }
};

async function columnExists(connection, table, column) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return Number(rows[0].n) > 0;
}

async function main() {
  loadEnvFile();
  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL, multipleStatements: true });
  await connection.query(fs.readFileSync("db/migrations/144_saas_peluqueria_salons.sql", "utf8"));

  // Peluqueria demo + sus peluqueros (los de siempre).
  await connection.query(
    `INSERT IGNORE INTO saas_peluqueria_salons (slug, name, schedule_json) VALUES ('demo', 'Peluquería Demo', ?)`,
    [JSON.stringify(DEFAULT_SCHEDULE)]
  );
  const [[salon]] = await connection.query(`SELECT id FROM saas_peluqueria_salons WHERE slug = 'demo'`);
  const names = ["Brian", "María", "Juan"];
  for (let i = 0; i < names.length; i++) {
    await connection.query(`INSERT IGNORE INTO saas_peluqueria_barbers (salon_id, name, position) VALUES (?, ?, ?)`, [salon.id, names[i], i]);
  }

  // Reservas: se cuelgan de una peluqueria y de un peluquero.
  const table = "saas_peluqueria_reservations";
  if (!(await columnExists(connection, table, "salon_id"))) {
    await connection.query(`ALTER TABLE ${table} ADD COLUMN salon_id INT UNSIGNED NULL AFTER id, ADD COLUMN barber_id INT UNSIGNED NULL AFTER salon_id, ADD COLUMN client_id INT UNSIGNED NULL`);
  }
  await connection.query(
    `UPDATE ${table} r JOIN saas_peluqueria_barbers b ON b.salon_id = ? AND b.name = r.peluquero
     SET r.salon_id = b.salon_id, r.barber_id = b.id WHERE r.barber_id IS NULL`,
    [salon.id]
  );
  const [[orphans]] = await connection.query(`SELECT COUNT(*) AS n FROM ${table} WHERE barber_id IS NULL`);
  if (Number(orphans.n) > 0) throw new Error(`Hay ${orphans.n} reservas sin peluquero conocido: revisar antes de cambiar la clave unica.`);

  const [indexes] = await connection.query(`SHOW INDEX FROM ${table} WHERE Key_name = 'uq_peluqueria_barber_slot'`);
  if (indexes.length === 0) {
    await connection.query(`ALTER TABLE ${table} ADD UNIQUE KEY uq_peluqueria_barber_slot (barber_id, reservation_date, reservation_time)`);
  }
  const [oldIndex] = await connection.query(`SHOW INDEX FROM ${table} WHERE Key_name = 'uq_peluqueria_slot'`);
  if (oldIndex.length > 0) await connection.query(`ALTER TABLE ${table} DROP INDEX uq_peluqueria_slot`);

  await connection.end();
  console.log("migration-144-ok (peluqueria demo id " + salon.id + ")");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
