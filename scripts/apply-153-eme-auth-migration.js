// Aplica la migracion 153 (login de EME) y crea/actualiza los 2 usuarios.
// Idempotente: se puede correr varias veces.
const fs = require("fs");
const mysql = require("mysql2/promise");
const { hash } = require("bcryptjs");

function loadEnvFile() {
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    if (key && !(key in process.env)) process.env[key] = line.slice(idx + 1).trim();
  }
}

// Las contraseñas NO van en el codigo: se pasan por variables de entorno al
// correr el script (EME_ADMIN_PASSWORD y EME_CLIENT_PASSWORD). Si un usuario
// ya existe no se toca.
const USERS = [
  { username: "admin", passwordEnv: "EME_ADMIN_PASSWORD", role: "admin", displayName: "Administrador" },
  { username: "nueva", passwordEnv: "EME_CLIENT_PASSWORD", role: "cliente", displayName: "Nueva Pizzería" }
];

async function main() {
  loadEnvFile();
  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL, multipleStatements: true });
  await connection.query(fs.readFileSync("db/migrations/153_saas_eme_auth.sql", "utf8"));
  for (const user of USERS) {
    const [rows] = await connection.query("SELECT id FROM saas_eme_users WHERE username = ?", [user.username]);
    if (rows.length) {
      console.log("ya existe", user.username);
      continue;
    }
    const password = process.env[user.passwordEnv];
    if (!password) {
      console.log("falta " + user.passwordEnv + ", no se crea", user.username);
      continue;
    }
    await connection.query("INSERT INTO saas_eme_users (username, password_hash, role, display_name) VALUES (?, ?, ?, ?)", [
      user.username,
      await hash(password, 12),
      user.role,
      user.displayName
    ]);
    console.log("creado", user.username);
  }
  await connection.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
