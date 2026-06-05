const fs = require("fs");
const mysql = require("mysql2/promise");
const { hash } = require("bcryptjs");

const CLIENT_IDENTIFIER = "rosendo";
const CLIENT_EMAIL = `${CLIENT_IDENTIFIER}@saaspro.local`;
const CLIENT_PASSWORD = "lamilagrosa";
const CLIENT_FULL_NAME = "Rosendo";
const CLIENT_TENANT_NAME = "La Milagrosa";
const CLIENT_TENANT_SLUG = "lamilagrosa";

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

  const passwordHash = await hash(CLIENT_PASSWORD, 12);
  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL });

  try {
    await connection.beginTransaction();

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
         SET full_name = ?,
             is_active = 1
         WHERE id = ?`,
        [CLIENT_FULL_NAME, userId]
      );
    }

    const [tenantRows] = await connection.query(
      `SELECT id
       FROM saas_tenants
       WHERE slug = ?
       LIMIT 1`,
      [CLIENT_TENANT_SLUG]
    );

    let tenantId = tenantRows[0]?.id;

    if (!tenantId) {
      const [tenantResult] = await connection.query(
        `INSERT INTO saas_tenants (name, slug, status)
         VALUES (?, ?, 'active')`,
        [CLIENT_TENANT_NAME, CLIENT_TENANT_SLUG]
      );
      tenantId = Number(tenantResult.insertId);
    } else {
      await connection.query(
        `UPDATE saas_tenants
         SET name = ?,
             status = 'active'
         WHERE id = ?`,
        [CLIENT_TENANT_NAME, tenantId]
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
      [tenantId, userId]
    );

    await connection.query(
      `INSERT INTO saas_tenant_settings (tenant_id, brand_name)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE brand_name = VALUES(brand_name)`,
      [tenantId, CLIENT_TENANT_NAME]
    );

    await connection.query(
      `INSERT INTO saas_tenant_modules (tenant_id, module_key, enabled)
       VALUES (?, 'agro', 1)
       ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)`,
      [tenantId]
    );

    await connection.commit();

    console.log(
      JSON.stringify(
        {
          ok: true,
          identifier: CLIENT_IDENTIFIER,
          email: CLIENT_EMAIL,
          password: CLIENT_PASSWORD,
          tenantId,
          userId,
          note: "El login puede hacerse con rosendo o con el email canonico. Si el usuario ya existia, este script no reescribe su contrasena."
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
