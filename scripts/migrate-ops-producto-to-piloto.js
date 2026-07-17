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

  const [result] = await connection.query(
    `INSERT INTO saas_piloto_products (
       name,
       barcode,
       barcode_normalized,
       price,
       stock,
       image_url,
       status,
       created_at,
       updated_at
     )
     SELECT
       nombre,
       barcode,
       barcode_normalized,
       precio_venta,
       stock_actual,
       imagen,
       CASE WHEN estado = 'activo' THEN 'active' ELSE 'inactive' END,
       created_at,
       updated_at
     FROM ops_producto
     WHERE barcode_normalized IS NOT NULL
       AND barcode_normalized <> ''
     ON DUPLICATE KEY UPDATE
       name = VALUES(name)`
  );

  console.log("filas insertadas/afectadas:", result.affectedRows);

  const [[{ total }]] = await connection.query(`SELECT COUNT(*) AS total FROM saas_piloto_products`);
  console.log("total en saas_piloto_products:", total);

  await connection.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
