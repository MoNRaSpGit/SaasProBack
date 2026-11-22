// EME: espacios separados por usuario (migracion 155).
//   node scripts/apply-155-eme-workspaces.js schema   -> agrega columnas (seguro con el servidor viejo)
//   node scripts/apply-155-eme-workspaces.js seed     -> copia el menu de "nueva" a "admin" (correr DESPUES de desplegar el servidor nuevo)
// Idempotente: se puede correr varias veces. No borra nada.
const fs = require("fs");
const mysql = require("mysql2/promise");
const { randomBytes } = require("crypto");

function loadEnvFile() {
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    if (key && !(key in process.env)) process.env[key] = line.slice(idx + 1).trim();
  }
}

async function userId(connection, username) {
  const [rows] = await connection.query("SELECT id FROM saas_eme_users WHERE username = ?", [username]);
  if (!rows[0]) throw new Error("No existe el usuario " + username);
  return rows[0].id;
}

async function schema(connection) {
  const nueva = await userId(connection, "nueva");
  if (nueva !== 2) throw new Error("El usuario nueva no tiene id 2 (tiene " + nueva + "): revisar el DEFAULT de la migracion 155.");
  const [cols] = await connection.query(
    "SELECT COUNT(*) n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'saas_eme_orders' AND COLUMN_NAME = 'workspace_id'"
  );
  if (Number(cols[0].n) > 0) {
    console.log("schema: ya estaba aplicado");
    return;
  }
  await connection.query(fs.readFileSync("db/migrations/155_saas_eme_workspaces.sql", "utf8"));
  console.log("schema: aplicado");
}

async function seed(connection) {
  const nueva = await userId(connection, "nueva");
  const admin = await userId(connection, "admin");
  const [has] = await connection.query("SELECT COUNT(*) n FROM saas_eme_categories WHERE workspace_id = ?", [admin]);
  if (Number(has[0].n) > 0) {
    console.log("seed: admin ya tiene menu, no se copia de nuevo");
    return;
  }
  await connection.beginTransaction();
  try {
    const [cats] = await connection.query("SELECT id, name, position FROM saas_eme_categories WHERE workspace_id = ? ORDER BY position, id", [nueva]);
    const catMap = new Map();
    for (const cat of cats) {
      const [created] = await connection.query("INSERT INTO saas_eme_categories (name, position, workspace_id) VALUES (?, ?, ?)", [cat.name, cat.position, admin]);
      catMap.set(cat.id, created.insertId);
    }
    const [products] = await connection.query("SELECT * FROM saas_eme_products WHERE workspace_id = ? AND active = 1 ORDER BY position, created_at", [nueva]);
    let copiedProducts = 0;
    for (const p of products) {
      const id = `p${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
      await connection.query(
        "INSERT INTO saas_eme_products (id, category_id, name, price, cost, emoji, position, workspace_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [id, catMap.get(p.category_id), p.name, p.price, p.cost, p.emoji, p.position, admin]
      );
      await connection.query(
        "INSERT INTO saas_eme_product_ingredients (product_id, position, name) SELECT ?, position, name FROM saas_eme_product_ingredients WHERE product_id = ? ORDER BY position, id",
        [id, p.id]
      );
      copiedProducts++;
    }
    await connection.query("INSERT INTO saas_eme_couriers (name, workspace_id) SELECT name, ? FROM saas_eme_couriers WHERE workspace_id = ? AND active = 1", [admin, nueva]);
    await connection.query("INSERT IGNORE INTO saas_eme_meta (id, version, workspace_id) VALUES (?, 1, ?)", [admin + 100, admin]);
    await connection.commit();
    console.log(`seed: copiadas ${cats.length} categorias y ${copiedProducts} productos a admin`);
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

async function main() {
  loadEnvFile();
  const step = process.argv[2];
  if (step !== "schema" && step !== "seed") throw new Error("Uso: node scripts/apply-155-eme-workspaces.js schema|seed");
  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL, multipleStatements: true });
  try {
    if (step === "schema") await schema(connection);
    else await seed(connection);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
