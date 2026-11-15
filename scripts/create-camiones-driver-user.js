// Crea (o actualiza) un usuario CAMIONERO en el mismo tenant de La Milagrosa
// (camiones-demo). El camionero solo puede cargar viajes (camion, zorra,
// cliente, origen, destino); el valor lo pone el administrador.
//
// Uso:
//   node scripts/create-camiones-driver-user.js <usuario> <contrasena> ["Nombre completo"]
// Entra con el <usuario> (se guarda como <usuario>@saaspro.local).
// Requiere la migracion 130 (rol 'camionero') aplicada antes.
const fs = require("fs");
const mysql = require("mysql2/promise");
const { hash } = require("bcryptjs");

const TARGET_TENANT_SLUG = "camiones-demo";

function loadEnvFile() {
  const envText = fs.readFileSync(".env", "utf8");
  for (const line of envText.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    if (key && !(key in process.env)) process.env[key] = line.slice(idx + 1).trim();
  }
}

async function main() {
  loadEnvFile();
  const [, , rawUsername, password, fullNameArg] = process.argv;
  if (!rawUsername || !password) {
    console.error('Uso: node scripts/create-camiones-driver-user.js <usuario> <contrasena> ["Nombre completo"]');
    process.exit(1);
  }
  const identifier = rawUsername.trim().toLowerCase();
  const email = `${identifier}@saaspro.local`;
  const fullName = fullNameArg?.trim() || rawUsername.trim();
  const passwordHash = await hash(password, 12);
  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL });

  try {
    await connection.beginTransaction();
    const [tenantRows] = await connection.query(`SELECT id, name FROM saas_tenants WHERE slug = ? LIMIT 1`, [TARGET_TENANT_SLUG]);
    const tenant = tenantRows[0];
    if (!tenant) throw new Error(`No se encontro el tenant ${TARGET_TENANT_SLUG}`);

    const [userRows] = await connection.query(`SELECT id FROM saasPro_users WHERE email = ? LIMIT 1`, [email]);
    let userId = userRows[0]?.id;
    if (!userId) {
      const [result] = await connection.query(
        `INSERT INTO saasPro_users (email, password_hash, full_name, role, is_active) VALUES (?, ?, ?, 'member', 1)`,
        [email, passwordHash, fullName]
      );
      userId = Number(result.insertId);
    } else {
      await connection.query(`UPDATE saasPro_users SET password_hash = ?, full_name = ?, is_active = 1 WHERE id = ?`, [passwordHash, fullName, userId]);
    }

    await connection.query(`UPDATE saas_tenant_memberships SET is_default = 0 WHERE user_id = ?`, [userId]);
    await connection.query(
      `INSERT INTO saas_tenant_memberships (tenant_id, user_id, role, status, is_default)
       VALUES (?, ?, 'camionero', 'active', 1)
       ON DUPLICATE KEY UPDATE role = VALUES(role), status = VALUES(status), is_default = VALUES(is_default)`,
      [tenant.id, userId]
    );
    await connection.commit();
    console.log(JSON.stringify({ ok: true, identifier, email, fullName, role: "camionero", tenant: tenant.name, userId }, null, 2));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
