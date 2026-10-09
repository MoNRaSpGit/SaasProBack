// Carga los clientes reales de frontend-distribuidora desde
// scripts/data/distribuidora-clients.json (salido de la planilla del
// cliente, "TOMAPEDIDOS_CLIENTES.xlsx", ya limpiada).
//
// OJO: ese .json tiene datos personales (nombres, telefonos, direcciones)
// y esta en .gitignore a proposito -- no se sube al repo. Si no esta en
// esta maquina hay que volver a generarlo desde la planilla.
//
// Uso:
//   node scripts/import-distribuidora-clients.js           -> solo muestra que haria
//   node scripts/import-distribuidora-clients.js --apply   -> lo hace
//
// Se puede volver a correr con una planilla actualizada: cada cliente se
// identifica por su CODIGO -- si ya existe se le actualizan los datos; si
// no, se da de alta. No borra nada, y los clientes dados de alta a mano
// desde la app (sin codigo) no se tocan.
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const BATCH_SIZE = 500;

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

async function main() {
  loadEnvFile();
  const apply = process.argv.includes("--apply");
  const clients = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "distribuidora-clients.json"), "utf8"));

  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL });
  try {
    const [existing] = await connection.query("SELECT code FROM saas_distribuidora_clients WHERE code IS NOT NULL");
    const existingCodes = new Set(existing.map((row) => row.code));
    const toCreate = clients.filter((client) => !existingCodes.has(client.code)).length;

    console.log(`En la planilla: ${clients.length} | altas: ${toCreate} | ya estaban (se actualizan): ${clients.length - toCreate}`);

    if (!apply) {
      console.log("Simulacion: no se cambio nada. Agregar --apply para cargarlo.");
      return;
    }

    await connection.beginTransaction();
    try {
      for (let start = 0; start < clients.length; start += BATCH_SIZE) {
        const batch = clients.slice(start, start + BATCH_SIZE);
        await connection.query(
          `INSERT INTO saas_distribuidora_clients
             (code, name, contact_name, rut, address, phone, seller_code, route, latitude, longitude) VALUES ?
           ON DUPLICATE KEY UPDATE name = VALUES(name), contact_name = VALUES(contact_name), rut = VALUES(rut),
             address = VALUES(address), phone = VALUES(phone), seller_code = VALUES(seller_code), route = VALUES(route),
             latitude = VALUES(latitude), longitude = VALUES(longitude)`,
          [
            batch.map((client) => [
              client.code,
              client.name,
              client.contactName,
              client.rut,
              client.address,
              client.phone,
              client.sellerCode,
              client.route,
              client.latitude,
              client.longitude
            ])
          ]
        );
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }

    const [[total]] = await connection.query(
      "SELECT COUNT(*) AS total, SUM(code IS NOT NULL) AS con_codigo, SUM(phone IS NOT NULL) AS con_telefono FROM saas_distribuidora_clients"
    );
    console.log(`Listo. Clientes en la base: ${total.total} (con codigo: ${total.con_codigo}, con telefono: ${total.con_telefono})`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
