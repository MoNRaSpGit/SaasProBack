const fs = require("fs");
const mysql = require("mysql2/promise");
const { hash } = require("bcryptjs");

const CLIENT_IDENTIFIER = "lamilagrosa";
const CLIENT_EMAIL = `${CLIENT_IDENTIFIER}@saaspro.local`;
const CLIENT_FULL_NAME = "La Milagrosa";
const TARGET_TENANT_SLUG = "camiones-demo";

function getRequiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Falta configurar ${name} en .env o en el entorno.`);
  }
  return value;
}

function loadEnvFile() {
  const envText = fs.readFileSync(".env", "utf8");

  for (const line of envText.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

async function main() {
  loadEnvFile();

  const clientPassword = getRequiredEnv("CAMIONES_CLIENT_PASSWORD");
  const passwordHash = await hash(clientPassword, 12);
  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL });

  try {
    await connection.beginTransaction();

    const [tenantRows] = await connection.query(
      `SELECT id, name
       FROM saas_tenants
       WHERE slug = ?
       LIMIT 1`,
      [TARGET_TENANT_SLUG]
    );

    const tenant = tenantRows[0];
    if (!tenant) {
      throw new Error(`No se encontro el tenant ${TARGET_TENANT_SLUG}`);
    }

    const [userRows] = await connection.query(
      `SELECT id
       FROM saasPro_users
       WHERE email = ?
       LIMIT 1`,
      [CLIENT_EMAIL]
    );

    let userId = userRows[0]?.id;

    if (!userId) {
      const [userResult] = await connection.query(
        `INSERT INTO saasPro_users (email, password_hash, full_name, role, is_active)
         VALUES (?, ?, ?, 'member', 1)`,
        [CLIENT_EMAIL, passwordHash, CLIENT_FULL_NAME]
      );
      userId = Number(userResult.insertId);
    } else {
      await connection.query(
        `UPDATE saasPro_users
         SET password_hash = ?,
             full_name = ?,
             is_active = 1
         WHERE id = ?`,
        [passwordHash, CLIENT_FULL_NAME, userId]
      );
    }

    await connection.query(
      `UPDATE saas_tenant_memberships
       SET is_default = 0
       WHERE user_id = ?`,
      [userId]
    );

    await connection.query(
      `INSERT INTO saas_tenant_memberships (tenant_id, user_id, role, status, is_default)
       VALUES (?, ?, 'admin', 'active', 1)
       ON DUPLICATE KEY UPDATE
         role = VALUES(role),
         status = VALUES(status),
         is_default = VALUES(is_default)`,
      [tenant.id, userId]
    );

    await connection.query(
      `INSERT INTO saas_tenant_modules (tenant_id, module_key, enabled)
       VALUES (?, 'camiones', 1)
       ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)`,
      [tenant.id]
    );

    await connection.commit();

    console.log(
      JSON.stringify(
        {
          ok: true,
          identifier: CLIENT_IDENTIFIER,
          email: CLIENT_EMAIL,
          passwordConfigured: true,
          tenantId: tenant.id,
          tenantName: tenant.name,
          userId,
          note: "Este usuario entra al mismo tenant del cliente actual de camiones."
        },
        null,
        2
      )
    );
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
