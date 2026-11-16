// Migracion 136: crea el login propio de Camiones y copia SOLO los usuarios
// reales (mismo id, mismo hash de clave). Se puede correr dos veces sin
// duplicar nada (INSERT IGNORE). No borra ni cambia nada del login viejo.
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

// id en saasPro_users -> usuario nuevo. Acordado con el usuario 17/11/2026:
// La Milagrosa (admin), Rodrigo y Gabriel (camioneros). "Camiones Demo" fue de
// prueba: se copia INACTIVO solo para que sus 18 viajes viejos sigan con nombre.
const USERS = [
  { id: 126, username: "lamilagrosa", active: 1 },
  { id: 134, username: "rodrigo", active: 1 },
  { id: 135, username: "gabriel", active: 1 },
  { id: 12, username: "camiones-demo", active: 0 }
];
const TENANT_ID = 10;

async function main() {
  loadEnvFile();
  const sql = fs.readFileSync("db/migrations/136_saas_camiones_own_auth.sql", "utf8");
  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL, multipleStatements: true });
  await connection.query(sql);

  for (const user of USERS) {
    const [result] = await connection.query(
      `INSERT IGNORE INTO saas_camiones_users
         (id, username, legacy_email, password_hash, full_name, role, tenant_id, tenant_name, tenant_slug, is_active)
       SELECT u.id, ?, u.email, u.password_hash, u.full_name, m.role, t.id, t.name, t.slug, ?
       FROM saasPro_users u
       INNER JOIN saas_tenant_memberships m ON m.user_id = u.id AND m.tenant_id = ?
       INNER JOIN saas_tenants t ON t.id = m.tenant_id
       WHERE u.id = ?`,
      [user.username, user.active, TENANT_ID, user.id]
    );
    console.log(`usuario ${user.username} (id ${user.id}): ${result.affectedRows ? "copiado" : "ya estaba / no encontrado"}`);
  }

  const [rows] = await connection.query(`SELECT id, username, legacy_email, full_name, role, is_active FROM saas_camiones_users ORDER BY id`);
  console.table(rows);
  await connection.end();
  console.log("migration-136-ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
