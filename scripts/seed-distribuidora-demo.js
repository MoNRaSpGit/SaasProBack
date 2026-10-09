// Datos de ejemplo para arrancar frontend-distribuidora (clientes y
// productos) -- sin esto la app abre vacia y no hay nada que buscar.
// Solo inserta si la tabla correspondiente esta VACIA, asi se puede
// correr mas de una vez sin duplicar ni pisar datos reales.
//
// Uso: node scripts/seed-distribuidora-demo.js
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

const CLIENTS = [
  ["Almacén González", "211234560018", "Av. Artigas 1234", "099 123 456"],
  ["Kiosco El Paso", "214567890012", "18 de Julio 456", "098 222 333"],
  ["Supermercado La Esquina", "217890120015", "Rivera 789", "4632 1122"],
  ["Bar Los Amigos", null, "Sarandí 321", "091 555 777"],
  ["Autoservice Rodríguez", "210987650011", "Gral. Flores 1500", "099 888 111"],
  ["Panadería San José", null, "Ituzaingó 98", "4633 4455"]
];

const PRODUCTS = [
  ["Coca-Cola 2.25 L", 165],
  ["Coca-Cola 1.5 L", 125],
  ["Coca-Cola 600 ml", 75],
  ["Coca-Cola Zero 1.5 L", 125],
  ["Fanta 2.25 L", 155],
  ["Fanta 600 ml", 72],
  ["Sprite 2.25 L", 155],
  ["Sprite 600 ml", 72],
  ["Agua Salus 2 L", 68],
  ["Agua Salus 600 ml", 42],
  ["Agua Salus con gas 1.5 L", 62],
  ["Pilsen 1 L", 138],
  ["Patricia 1 L", 142],
  ["Paso de los Toros Pomelo 1.5 L", 118],
  ["Jugo Conaprole Naranja 1 L", 96]
];

async function main() {
  loadEnvFile();
  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL });
  try {
    const [[clients]] = await connection.query("SELECT COUNT(*) AS n FROM saas_distribuidora_clients");
    if (clients.n === 0) {
      await connection.query("INSERT INTO saas_distribuidora_clients (name, rut, address, phone) VALUES ?", [CLIENTS]);
      console.log(`clientes de ejemplo: ${CLIENTS.length}`);
    } else {
      console.log(`clientes: ya hay ${clients.n}, no se toca`);
    }

    const [[products]] = await connection.query("SELECT COUNT(*) AS n FROM saas_distribuidora_products");
    if (products.n === 0) {
      await connection.query("INSERT INTO saas_distribuidora_products (name, price) VALUES ?", [PRODUCTS]);
      console.log(`productos de ejemplo: ${PRODUCTS.length}`);
    } else {
      console.log(`productos: ya hay ${products.n}, no se toca`);
    }
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
