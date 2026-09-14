// Crea (o actualiza la password de) el usuario administrador de
// frontend-qq. El registro publico SIEMPRE da rol "usuario" -- el
// administrador (el que carga/edita/borra productos) se crea a mano,
// una sola vez, con este script.
//
// Uso:
//   node scripts/create-qq-admin-user.js <email> <password> ["Nombre completo"]
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
  const [, , email, password, fullName] = process.argv;
  if (!email || !password) {
    console.error("Uso: node scripts/create-qq-admin-user.js <email> <password> [\"Nombre completo\"]");
    process.exit(1);
  }

  const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL });
  const passwordHash = await bcrypt.hash(password, 12);
  const normalizedEmail = email.trim().toLowerCase();

  const [existing] = await conn.query(`SELECT id FROM saas_qq_users WHERE email = ? LIMIT 1`, [normalizedEmail]);
  if (existing.length) {
    await conn.execute(`UPDATE saas_qq_users SET password_hash = ?, role = 'administrador', full_name = ? WHERE id = ?`, [
      passwordHash,
      fullName || null,
      existing[0].id
    ]);
    console.log("actualizado a administrador:", normalizedEmail);
  } else {
    await conn.execute(
      `INSERT INTO saas_qq_users (email, password_hash, full_name, role) VALUES (?, ?, ?, 'administrador')`,
      [normalizedEmail, passwordHash, fullName || null]
    );
    console.log("administrador creado:", normalizedEmail);
  }

  await conn.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
