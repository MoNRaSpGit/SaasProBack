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

const CATEGORY = "Refrescos Chicos";

const PRODUCTS = [
  { name: "Coca-Cola (600 ml)", price: 100 },
  { name: "Coca-Cola Zero (600 ml)", price: 100 },
  { name: "Sprite (600 ml)", price: 100 },
  { name: "Fanta (500 ml)", price: 100 },
  { name: "7 Up Zero (500 ml)", price: 100 },
  { name: "Pomelo Paso de los Toros (500 ml)", price: 100 },
  { name: "Tónica Paso de los Toros (500 ml)", price: 100 },
  { name: "Pepsi Clásica (Lata 355 ml)", price: 60 },
  { name: "Pepsi Twist Limón Zero (Lata 355 ml)", price: 60 },
  { name: "Agua Vital (625 ml)", price: 55 }
];

async function main() {
  loadEnvFile();

  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL });

  for (const item of PRODUCTS) {
    await connection.execute(
      `INSERT INTO saas_joker_products
         (name, category, subcategory, subcategory_detail, brand, price, ingredients, observations, product_type, status, pricing_unit)
       VALUES (?, ?, NULL, NULL, NULL, ?, NULL, NULL, 'simple', 'published', 'unidad')`,
      [item.name, CATEGORY, item.price]
    );
  }

  console.log(`add-joker-refrescos-chicos-ok: ${PRODUCTS.length} productos agregados en categoria "${CATEGORY}"`);
  await connection.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
