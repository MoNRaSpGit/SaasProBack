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

async function main() {
  loadEnvFile();

  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL });

  await connection.execute(
    `INSERT INTO saas_joker_products
       (name, category, subcategory, subcategory_detail, brand, price, ingredients, observations, product_type, status, pricing_unit)
     VALUES ('ImprimirPrueba', 'Prueba', NULL, NULL, NULL, 0, NULL, NULL, 'simple', 'published', 'unidad')`
  );

  console.log("add-joker-imprimir-prueba-ok");
  await connection.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
