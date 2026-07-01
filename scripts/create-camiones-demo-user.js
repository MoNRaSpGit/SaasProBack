const fs = require("fs");
const mysql = require("mysql2/promise");
const { hash } = require("bcryptjs");

const DEMO_EMAIL = "camiones.demo@saaspro.com";
const DEMO_FULL_NAME = "Camiones Demo";
const DEMO_TENANT_NAME = "Camiones Demo";
const DEMO_TENANT_SLUG = "camiones-demo";

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

  const demoPassword = getRequiredEnv("CAMIONES_DEMO_PASSWORD");
  const passwordHash = await hash(demoPassword, 12);
  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL });

  try {
    await connection.beginTransaction();

    const [userRows] = await connection.query(
      `SELECT id
       FROM saasPro_users
       WHERE email = ?
       LIMIT 1`,
      [DEMO_EMAIL]
    );

    let userId = userRows[0]?.id;

    if (!userId) {
      const [userResult] = await connection.query(
        `INSERT INTO saasPro_users (email, password_hash, full_name, role, is_active)
         VALUES (?, ?, ?, 'member', 1)`,
        [DEMO_EMAIL, passwordHash, DEMO_FULL_NAME]
      );
      userId = Number(userResult.insertId);
    } else {
      await connection.query(
        `UPDATE saasPro_users
         SET password_hash = ?,
             full_name = ?,
             is_active = 1
         WHERE id = ?`,
        [passwordHash, DEMO_FULL_NAME, userId]
      );
    }

    const [tenantRows] = await connection.query(
      `SELECT id
       FROM saas_tenants
       WHERE slug = ?
       LIMIT 1`,
      [DEMO_TENANT_SLUG]
    );

    let tenantId = tenantRows[0]?.id;

    if (!tenantId) {
      const [tenantResult] = await connection.query(
        `INSERT INTO saas_tenants (name, slug, status)
         VALUES (?, ?, 'active')`,
        [DEMO_TENANT_NAME, DEMO_TENANT_SLUG]
      );
      tenantId = Number(tenantResult.insertId);
    } else {
      await connection.query(
        `UPDATE saas_tenants
         SET name = ?,
             status = 'active'
         WHERE id = ?`,
        [DEMO_TENANT_NAME, tenantId]
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
      [tenantId, DEMO_TENANT_NAME]
    );

    await connection.query(
      `INSERT INTO saas_tenant_modules (tenant_id, module_key, enabled)
       VALUES (?, 'camiones', 1)
       ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)`,
      [tenantId]
    );

    await connection.commit();

    console.log(
      JSON.stringify(
        {
          ok: true,
          email: DEMO_EMAIL,
          passwordConfigured: true,
          tenantId,
          userId
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
