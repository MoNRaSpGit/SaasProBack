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

const BEBIDA_CATEGORIES = new Set([
  "Bebidas",
  "Refrescos",
  "Refrescos Chicos",
  "Cerveza Artesanal",
  "Cerveza Industrial",
  "Vinos Embotellados",
  "Vinos en Caja",
  "Whiskies"
]);

const EXCLUDED_CATEGORIES = new Set(["Prueba"]);

function resolveStockCategory(productCategory) {
  if (BEBIDA_CATEGORIES.has(productCategory)) return "bebida";
  if (productCategory === "Cigarros") return "otro";
  return "comida";
}

async function main() {
  loadEnvFile();

  const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL });

  // Productos publicados, simples (no "extra"), sin ninguna receta cargada
  // todavia -- los que ya tienen receta (hamburguesas, combos) quedan
  // afuera para no duplicar/romper lo que ya funciona.
  const [products] = await conn.query(`
    SELECT p.id, p.name, p.category
    FROM saas_joker_products p
    LEFT JOIN saas_joker_product_recipes r ON r.product_id = p.id
    WHERE r.product_id IS NULL AND p.status = 'published' AND p.product_type = 'simple'
    ORDER BY p.id
  `);

  const [existingStockItems] = await conn.query(`SELECT id, name FROM saas_joker_stock_items`);
  const stockItemIdByName = new Map(existingStockItems.map((row) => [row.name, row.id]));

  let created = 0;
  let recipesCreated = 0;
  let skipped = 0;

  for (const product of products) {
    if (EXCLUDED_CATEGORIES.has(product.category)) {
      skipped += 1;
      continue;
    }

    let stockItemId = stockItemIdByName.get(product.name);

    if (!stockItemId) {
      // Valores variados a proposito (0-15) para poder probar como se ven
      // las alertas de stock bajo con una mezcla real de casos.
      const initialQuantity = product.id % 16;
      const category = resolveStockCategory(product.category);

      const [result] = await conn.execute(
        `INSERT INTO saas_joker_stock_items (name, unit, category, quantity) VALUES (?, 'unidad', ?, ?)`,
        [product.name, category, initialQuantity]
      );
      stockItemId = result.insertId;
      stockItemIdByName.set(product.name, stockItemId);
      created += 1;
    }

    await conn.execute(
      `INSERT INTO saas_joker_product_recipes (product_id, stock_item_id, quantity_per_unit) VALUES (?, ?, 1)`,
      [product.id, stockItemId]
    );
    recipesCreated += 1;
  }

  console.log("seed-joker-stock-for-all-products-ok", { productsSeen: products.length, created, recipesCreated, skipped });
  await conn.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
