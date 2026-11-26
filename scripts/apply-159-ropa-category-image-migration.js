const fs = require("fs");
const mysql = require("mysql2/promise");

function loadEnvFile() {
  for (const line of fs.readFileSync(".env", "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    if (key && !(key in process.env)) process.env[key] = line.slice(idx + 1).trim();
  }
}

async function main() {
  loadEnvFile();
  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL, multipleStatements: true });
  const [columns] = await connection.query("SHOW COLUMNS FROM saas_ropa_categories LIKE 'image_url'");
  if (columns.length === 0) await connection.query(fs.readFileSync("db/migrations/159_saas_ropa_category_image.sql", "utf8"));
  await connection.end();
  console.log("migration-159-ok");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
