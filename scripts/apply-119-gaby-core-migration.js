// Crea las tablas de Gaby Almacen (migracion 119) y, UNA sola vez, copia el
// catalogo de productos de Piloto (nombre, codigo, precio; stock en 0, sin
// imagenes). NO copia ventas ni clientes. Idempotente: si Gaby ya tiene
// productos, no vuelve a copiar.
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
  const sql = fs.readFileSync("db/migrations/119_saas_gaby_core.sql", "utf8");
  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL, multipleStatements: true });
  await connection.query(sql);
  const [[{ n }]] = await connection.query("SELECT COUNT(*) n FROM saas_gaby_products");
  if (Number(n) === 0) {
    const [result] = await connection.query(
      `INSERT INTO saas_gaby_products (name, barcode, barcode_normalized, price, stock, has_image, status)
       SELECT name, barcode, barcode_normalized, price, 0, 0, status FROM saas_piloto_products`
    );
    console.log("productos copiados de Piloto:", result.affectedRows);
  } else {
    console.log("Gaby ya tiene productos, no se copia nada:", n);
  }
  await connection.end();
  console.log("migration-119-ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
