// Crea las tablas de EME (migracion 148) y carga lo inicial: el menu FICTICIO de
// ejemplo (precios inventados, hasta cargar los reales) y los 2 repartidores de
// ejemplo. NO migra los pedidos ni los clientes de prueba: la app arranca vacia.
// Se puede correr mas de una vez (no duplica).
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

const CATEGORIES = ["Pizzas", "Hamburguesas", "Minutas", "Bebidas", "Postres"];
// [id, categoria, nombre, precio, costo, emoji] -- precios ficticios.
const PRODUCTS = [
  ["pz-muza", "Pizzas", "Pizza muzzarella", 420, 170, "🍕"],
  ["pz-esp", "Pizzas", "Pizza especial", 560, 230, "🍕"],
  ["pz-fuga", "Pizzas", "Fugazzeta", 520, 200, "🍕"],
  ["pz-napo", "Pizzas", "Pizza napolitana", 540, 215, "🍕"],
  ["hb-clas", "Hamburguesas", "Hamburguesa clásica", 390, 150, "🍔"],
  ["hb-doble", "Hamburguesas", "Hamburguesa doble", 520, 210, "🍔"],
  ["hb-bacon", "Hamburguesas", "Hamburguesa con bacon", 560, 230, "🥓"],
  ["mi-mila", "Minutas", "Milanesa con papas", 480, 190, "🥩"],
  ["mi-chivi", "Minutas", "Chivito al plato", 690, 290, "🥪"],
  ["mi-papas", "Minutas", "Papas fritas", 220, 70, "🍟"],
  ["bb-coca", "Bebidas", "Coca-Cola 500 ml", 120, 55, "🥤"],
  ["bb-coca15", "Bebidas", "Coca-Cola 1,5 L", 210, 100, "🥤"],
  ["bb-agua", "Bebidas", "Agua mineral", 90, 35, "💧"],
  ["bb-cerv", "Bebidas", "Cerveza 1 L", 260, 120, "🍺"],
  ["po-flan", "Postres", "Flan con dulce de leche", 180, 60, "🍮"],
  ["po-helado", "Postres", "Helado 2 bochas", 200, 70, "🍨"]
];

async function main() {
  loadEnvFile();
  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL, multipleStatements: true });
  await connection.query(fs.readFileSync("db/migrations/148_saas_eme_core.sql", "utf8"));
  await connection.query(`INSERT IGNORE INTO saas_eme_meta (id, version) VALUES (1, 1)`);

  const [[{ n: categoryCount }]] = await connection.query(`SELECT COUNT(*) AS n FROM saas_eme_categories`);
  if (Number(categoryCount) === 0) {
    for (let i = 0; i < CATEGORIES.length; i++) {
      await connection.query(`INSERT INTO saas_eme_categories (name, position) VALUES (?, ?)`, [CATEGORIES[i], i]);
    }
    const [cats] = await connection.query(`SELECT id, name FROM saas_eme_categories`);
    const idByName = new Map(cats.map((row) => [row.name, row.id]));
    for (let i = 0; i < PRODUCTS.length; i++) {
      const [id, category, name, price, cost, emoji] = PRODUCTS[i];
      await connection.query(
        `INSERT INTO saas_eme_products (id, category_id, name, price, cost, emoji, position) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, idByName.get(category), name, price, cost, emoji, i]
      );
    }
    console.log("menu de ejemplo cargado:", PRODUCTS.length, "productos");
  }

  const [[{ n: courierCount }]] = await connection.query(`SELECT COUNT(*) AS n FROM saas_eme_couriers`);
  if (Number(courierCount) === 0) {
    await connection.query(`INSERT INTO saas_eme_couriers (name) VALUES ('Martín'), ('Lucía')`);
    console.log("repartidores de ejemplo cargados");
  }

  await connection.end();
  console.log("migration-148-ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
