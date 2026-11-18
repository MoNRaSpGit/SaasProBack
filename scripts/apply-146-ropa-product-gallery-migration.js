const fs = require("fs");
const mysql = require("mysql2/promise");

function loadEnvFile() {
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
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
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'saas_ropa_product_gallery'`
  );
  if (Number(rows[0].n) > 0) {
    console.log("migration-146 ya estaba aplicada");
  } else {
    await connection.query(fs.readFileSync("db/migrations/146_saas_ropa_product_gallery.sql", "utf8"));
    console.log("migration-146-ok");
  }
  await connection.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
