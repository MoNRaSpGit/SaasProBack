// Migracion 137: login propio de Agro. Copia SOLO a Rosendo (id 130, mismo
// hash de clave). "La Milagrosa" (id 126) NO se copia: acordado 17/11/2026,
// en Agro no se usa. Idempotente (INSERT IGNORE). No toca el login viejo.
const fs = require("fs");
const mysql = require("mysql2/promise");

function loadEnvFile() {
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    if (key && !(key in process.env)) process.env[key] = line.slice(idx + 1).trim();
  }
}

async function main() {
  loadEnvFile();
  const sql = fs.readFileSync("db/migrations/137_saas_agro_own_auth.sql", "utf8");
  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL, multipleStatements: true });
  await connection.query(sql);
  const [result] = await connection.query(
    `INSERT IGNORE INTO saas_agro_users (id, username, password_hash, full_name, role, tenant_id, tenant_name, tenant_slug, is_active)
     SELECT u.id, 'rosendo', u.password_hash, u.full_name, m.role, t.id, t.name, t.slug, 1
     FROM saasPro_users u
     INNER JOIN saas_tenant_memberships m ON m.user_id = u.id AND m.tenant_id = 123
     INNER JOIN saas_tenants t ON t.id = m.tenant_id
     WHERE u.id = 130`
  );
  console.log(`rosendo: ${result.affectedRows ? "copiado" : "ya estaba"}`);
  const [rows] = await connection.query(`SELECT id, username, full_name, role, tenant_id, is_active FROM saas_agro_users`);
  console.table(rows);
  await connection.end();
  console.log("migration-137-ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
