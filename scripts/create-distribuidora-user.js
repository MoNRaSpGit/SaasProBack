// Crea (o actualiza la contrasena/rol de) un usuario de
// frontend-distribuidora. No hay registro publico: los usuarios se crean
// a mano con este script.
//
// Uso:
//   node scripts/create-distribuidora-user.js <usuario> <contrasena> <admin|vendedor> ["Nombre completo"]
const fs = require("fs");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

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
  const [, , username, password, role, fullName] = process.argv;
  if (!username || !password || !role || !["admin", "vendedor"].includes(role)) {
    console.error('Uso: node scripts/create-distribuidora-user.js <usuario> <contrasena> <admin|vendedor> ["Nombre completo"]');
    process.exit(1);
  }

  const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL });
  const passwordHash = await bcrypt.hash(password, 12);
  const normalizedUsername = username.trim().toLowerCase();

  const [existing] = await conn.query(`SELECT id FROM saas_distribuidora_users WHERE username = ? LIMIT 1`, [normalizedUsername]);
  if (existing.length) {
    await conn.execute(`UPDATE saas_distribuidora_users SET password_hash = ?, full_name = ?, role = ? WHERE id = ?`, [
      passwordHash,
      fullName || null,
      role,
      existing[0].id
    ]);
    console.log("usuario actualizado:", normalizedUsername, "rol:", role);
  } else {
    await conn.execute(`INSERT INTO saas_distribuidora_users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)`, [
      normalizedUsername,
      passwordHash,
      fullName || null,
      role
    ]);
    console.log("usuario creado:", normalizedUsername, "rol:", role);
  }

  await conn.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
