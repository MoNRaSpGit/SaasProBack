// Carga el catalogo real de frontend-distribuidora desde
// scripts/data/distribuidora-products.json (salido de la planilla del
// cliente, "TOMAPEDIDOS_PRODUCTOS.xlsx": codigo, nombre, categoria, precio).
//
// Uso:
//   node scripts/import-distribuidora-products.js           -> solo muestra que haria
//   node scripts/import-distribuidora-products.js --apply   -> lo hace
//
// Se puede volver a correr con una planilla actualizada: cada producto se
// identifica por su CODIGO -- si ya existe se le actualiza nombre, precio y
// categoria; si no, se da de alta. No borra nada: un producto que ya no
// venga en la planilla queda como estaba. Los productos dados de alta a
// mano desde la app (sin codigo) no se tocan.
const fs = require("fs");
const path = require("path");
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
  const apply = process.argv.includes("--apply");
  const products = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "distribuidora-products.json"), "utf8"));

  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL });
  try {
    const [existing] = await connection.query("SELECT code, name, price FROM saas_distribuidora_products WHERE code IS NOT NULL");
    const existingByCode = new Map(existing.map((row) => [row.code, row]));

    const toCreate = products.filter((product) => !existingByCode.has(product.code));
    const toUpdate = products.filter((product) => {
      const current = existingByCode.get(product.code);
      return current && (current.name !== product.name || Number(current.price) !== product.price);
    });

    console.log(`En la planilla: ${products.length} | altas: ${toCreate.length} | con cambios de nombre/precio: ${toUpdate.length}`);
    for (const product of toUpdate.slice(0, 20)) {
      const current = existingByCode.get(product.code);
      console.log(`  ${product.code}: "${current.name}" $${Number(current.price)} -> "${product.name}" $${product.price}`);
    }

    if (!apply) {
      console.log("Simulacion: no se cambio nada. Agregar --apply para cargarlo.");
      return;
    }

    await connection.beginTransaction();
    try {
      await connection.query(
        `INSERT INTO saas_distribuidora_products (code, name, category, price, status) VALUES ?
         ON DUPLICATE KEY UPDATE name = VALUES(name), category = VALUES(category), price = VALUES(price)`,
        [products.map((product) => [product.code, product.name, product.category, product.price, product.active ? "active" : "inactive"])]
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }

    const [[total]] = await connection.query(
      "SELECT COUNT(*) AS total, SUM(code IS NOT NULL) AS con_codigo, SUM(status = 'active') AS activos FROM saas_distribuidora_products"
    );
    console.log(`Listo. Productos en la base: ${total.total} (con codigo: ${total.con_codigo}, activos: ${total.activos})`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
