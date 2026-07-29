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

const CATEGORY = "Refrescos";

const PRODUCTS = [
  { name: "Coca-Cola (Botella vidrio 1 litro)", price: 130 },
  { name: "Coca-Cola (2 litros)", price: 160 },
  { name: "Coca-Cola Cero (2 litros)", price: 170 },
  { name: "Fanta (2.25 litros)", price: 190 },
  { name: "Sprite (2.25 litros)", price: 190 },
  { name: "7 Up Sin Azúcar (1.5 litros)", price: 150 },
  { name: "Pomelo Paso de los Toros (1.5 litros)", price: 150 },
  { name: "7 Up Sin Azúcar (2 litros)", price: 160 },
  { name: "Mirinda (2.5 litros)", price: 180 },
  { name: "7 Up Sin Azúcar (2.5 litros)", price: 180 },
  { name: "Pomelo Paso de los Toros (2.5 litros)", price: 190 },
  { name: "Pomelo Paso de los Toros Cero (2.5 litros)", price: 195 },
  { name: "Pomelo Paso de los Toros Cero (1.5 litros)", price: 160 },
  { name: "Tónica Paso de los Toros (1.5 litros)", price: 160 },
  { name: "Pepsi Cero (1.5 litros)", price: 150 },
  { name: "Salo Fruté (1.5 litros)", price: 130 },
  { name: "Cepita Sin Azúcar (1.5 litros)", price: 130 },
  { name: "Big C Naranja (Jugo en caja 1 litro)", price: 100 },
  { name: "Big C (Jugo en caja 200 ml)", price: 30 },
  { name: "Agua Vitale (1.75 litros)", price: 60 },
  { name: "Agua Vitale (2.5 litros)", price: 80 }
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

  console.log(`add-joker-refrescos-ok: ${PRODUCTS.length} productos agregados en categoria "${CATEGORY}"`);
  await connection.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
