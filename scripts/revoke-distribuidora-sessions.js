// Cierra TODAS las sesiones activas de frontend-distribuidora (02/11/2026,
// pedido explicito: "cerrar la sesion de todos y que vuelvan a loguearse"
// justo despues de bajar el TTL de 30 dias a 24hs). Uso puntual, no se
// corre solo.
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

async function main() {
  loadEnvFile();
  const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL });
  const [result] = await conn.execute("DELETE FROM saas_distribuidora_sessions");
  await conn.end();
  console.log(`sesiones cerradas: ${result.affectedRows}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
