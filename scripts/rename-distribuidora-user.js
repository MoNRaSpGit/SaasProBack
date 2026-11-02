// Renombra el usuario de login de frontend-distribuidora (03/11/2026,
// pedido explicito: "no era Valentina, era Valeria" -- todavia sin
// pedidos reales, asi que se edita el usuario en vez de crear uno
// nuevo). Uso puntual.
//
// Uso: node scripts/rename-distribuidora-user.js <usuario-viejo> <usuario-nuevo>
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
  const [, , oldUsername, newUsername] = process.argv;
  if (!oldUsername || !newUsername) {
    console.error("Uso: node scripts/rename-distribuidora-user.js <usuario-viejo> <usuario-nuevo>");
    process.exit(1);
  }

  const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL });
  const [result] = await conn.execute(`UPDATE saas_distribuidora_users SET username = ? WHERE username = ?`, [
    newUsername.trim().toLowerCase(),
    oldUsername.trim().toLowerCase()
  ]);
  await conn.end();
  if (result.affectedRows === 0) {
    console.error(`no se encontro el usuario "${oldUsername}"`);
    process.exit(1);
  }
  console.log(`usuario renombrado: ${oldUsername} -> ${newUsername}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
