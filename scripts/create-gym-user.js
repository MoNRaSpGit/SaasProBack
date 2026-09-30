// Crea (o actualiza la contrasena de) un usuario de frontend-gym. No hay
// registro publico: los usuarios se crean a mano con este script.
//
// Uso:
//   node scripts/create-gym-user.js <usuario> <contrasena> ["Nombre completo"] [workspace]
//
// [workspace] es opcional: sin el, un usuario nuevo comparte el workspace
// 'public' (los datos del gym de siempre); con un nombre propio arranca
// con un workspace vacio solo para el. Al actualizar un usuario existente
// sin pasarlo, se mantiene el que ya tenia.
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
  const [, , username, password, fullName, workspaceKey] = process.argv;
  if (!username || !password) {
    console.error('Uso: node scripts/create-gym-user.js <usuario> <contrasena> ["Nombre completo"]');
    process.exit(1);
  }

  const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL });
  const passwordHash = await bcrypt.hash(password, 12);
  const normalizedUsername = username.trim().toLowerCase();

  const [existing] = await conn.query(`SELECT id FROM saas_gym_users WHERE username = ? LIMIT 1`, [normalizedUsername]);
  if (existing.length) {
    await conn.execute(
      `UPDATE saas_gym_users SET password_hash = ?, full_name = ?, workspace_key = COALESCE(?, workspace_key) WHERE id = ?`,
      [passwordHash, fullName || null, workspaceKey || null, existing[0].id]
    );
    console.log("usuario actualizado:", normalizedUsername);
  } else {
    await conn.execute(
      `INSERT INTO saas_gym_users (username, password_hash, full_name, workspace_key) VALUES (?, ?, ?, ?)`,
      [normalizedUsername, passwordHash, fullName || null, workspaceKey || "public"]
    );
    console.log("usuario creado:", normalizedUsername, "workspace:", workspaceKey || "public");
  }

  await conn.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
