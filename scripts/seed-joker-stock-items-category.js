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

// Insumos que hoy son bebida (todo lo demas ya quedo bien como "comida" por
// el default de la columna).
const BEBIDA_IDS = [20, 21, 22, 38, 39, 23, 24, 25, 26, 40, 27, 41, 28, 42, 47, 29, 30, 31, 32, 43, 33, 34, 35, 36, 44, 37, 45];

async function main() {
  loadEnvFile();

  const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL });
  const [result] = await conn.query(
    `UPDATE saas_joker_stock_items SET category = 'bebida' WHERE id IN (${BEBIDA_IDS.join(",")})`
  );
  console.log("seed-joker-stock-items-category-ok", { updated: result.affectedRows });
  await conn.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
