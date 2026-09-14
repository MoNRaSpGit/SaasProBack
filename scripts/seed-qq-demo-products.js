// Carga productos de ejemplo para frontend-qq (14/09/2026): el cliente
// vende cuentas/perfiles de plataformas de streaming (Netflix, Disney+,
// etc.) -- esto es solo para poblar el catalogo mientras no hay fotos/
// productos reales cargados. category matchea las claves de
// qq.theme.ts (frontend) para que cada tarjeta salga con su color propio.
const fs = require("fs");
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

const PRODUCTS = [
  { name: "Netflix", category: "netflix", description: "1 pantalla · 1 mes", price: 199, currency: "UYU" },
  { name: "Disney+", category: "disney+", description: "Perfil individual · 1 mes", price: 179, currency: "UYU" },
  { name: "HBO Max", category: "hbo max", description: "1 pantalla · 1 mes", price: 149, currency: "UYU" },
  { name: "YouTube Premium", category: "youtube premium", description: "Sin anuncios · 1 mes", price: 159, currency: "UYU" },
  { name: "Spotify Premium", category: "spotify", description: "Cuenta individual · 1 mes", price: 129, currency: "UYU" },
  { name: "Amazon Prime Video", category: "prime video", description: "1 pantalla · 1 mes", price: 139, currency: "UYU" },
  { name: "Paramount+", category: "paramount+", description: "Perfil individual · 1 mes", price: 119, currency: "UYU" },
  { name: "Apple TV+", category: "apple tv+", description: "1 pantalla · 1 mes", price: 149, currency: "UYU" },
  { name: "Star+", category: "star+", description: "Perfil individual · 1 mes", price: 149, currency: "UYU" },
  { name: "Crunchyroll", category: "crunchyroll", description: "Cuenta individual · 1 mes", price: 129, currency: "UYU" },
  { name: "Xbox Game Pass Ultimate", category: "xbox game pass", description: "1 mes · catálogo completo", price: 249, currency: "UYU" },
  { name: "PlayStation Plus", category: "playstation plus", description: "Plan Extra · 1 mes", price: 279, currency: "UYU" },
  { name: "Steam Wallet", category: "steam", description: "Carga U$S 20", price: 899, currency: "UYU" },
  { name: "Nintendo Switch Online", category: "nintendo online", description: "Membresía individual · 12 meses", price: 599, currency: "UYU" }
];

async function main() {
  loadEnvFile();
  const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL });

  for (const product of PRODUCTS) {
    const [existing] = await conn.query(`SELECT id FROM saas_qq_products WHERE name = ? LIMIT 1`, [product.name]);
    if (existing.length) {
      console.log("ya existe, se salta:", product.name);
      continue;
    }
    await conn.execute(
      `INSERT INTO saas_qq_products (name, description, price, currency, category, status) VALUES (?, ?, ?, ?, ?, 'published')`,
      [product.name, product.description, product.price, product.currency, product.category]
    );
    console.log("insertado:", product.name);
  }

  await conn.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
