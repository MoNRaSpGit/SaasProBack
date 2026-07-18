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

const COMBINING_DIACRITICS_REGEX = new RegExp("[\\u0300-\\u036f]", "g");

function stripAccents(value) {
  return value.normalize("NFD").replace(COMBINING_DIACRITICS_REGEX, "");
}

const BACKUP_TABLES = [
  "saas_carnet_players",
  "saas_carnet_events",
  "saas_carnet_event_players",
  "saas_carnet_event_player_buyers"
];

async function countRows(connection, table) {
  const [rows] = await connection.query(`SELECT COUNT(*) AS total FROM ${table}`);
  return Number(rows[0].total);
}

async function backupTable(connection, table) {
  const backupTable = `${table}_backup`;
  const beforeCount = await countRows(connection, table);

  await connection.query(`CREATE TABLE IF NOT EXISTS ${backupTable} AS SELECT * FROM ${table}`);

  const backupCount = await countRows(connection, backupTable);

  console.log(`backup ${backupTable}: original=${beforeCount} filas, backup=${backupCount} filas`);
}

async function stripAccentsInColumn(connection, table, idColumn, textColumn) {
  const [rows] = await connection.query(`SELECT ${idColumn} AS id, ${textColumn} AS value FROM ${table}`);
  let changed = 0;

  for (const row of rows) {
    if (row.value === null || row.value === undefined) continue;
    const normalized = stripAccents(String(row.value));
    if (normalized !== row.value) {
      await connection.execute(`UPDATE ${table} SET ${textColumn} = ? WHERE ${idColumn} = ?`, [normalized, row.id]);
      changed += 1;
    }
  }

  console.log(`${table}.${textColumn}: ${rows.length} filas revisadas, ${changed} actualizadas`);
}

async function main() {
  loadEnvFile();
  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL, charset: "utf8mb4" });

  console.log("=== Paso 1: backup estatico (no sincronizado) ===");
  for (const table of BACKUP_TABLES) {
    await backupTable(connection, table);
  }

  console.log("");
  console.log("=== Paso 2: sacar acentos en las tablas originales ===");
  await stripAccentsInColumn(connection, "saas_carnet_players", "id", "name");
  await stripAccentsInColumn(connection, "saas_carnet_events", "id", "name");
  await stripAccentsInColumn(connection, "saas_carnet_event_player_buyers", "id", "buyer_name");

  console.log("");
  console.log("=== Verificacion de conteos (nada se borro) ===");
  for (const table of BACKUP_TABLES) {
    const total = await countRows(connection, table);
    console.log(`${table}: ${total} filas`);
  }

  await connection.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
