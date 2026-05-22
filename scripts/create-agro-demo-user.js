const fs = require("fs");
const mysql = require("mysql2/promise");
const { hash } = require("bcryptjs");

const DEMO_IDENTIFIER = "agrodemo";
const DEMO_EMAIL = `${DEMO_IDENTIFIER}@saaspro.local`;
const DEMO_PASSWORD = "123";
const DEMO_FULL_NAME = "Agro Demo";
const DEMO_TENANT_NAME = "Agro Demo";
const DEMO_TENANT_SLUG = "agro-demo";
const WORKSPACE_KEY = "public";
const WORKSPACE_VERSION = "v1";

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

function createEmptyWorkspace() {
  return {
    establishments: [],
    fields: [],
    animalMovements: [],
    accountingEntries: [],
    rainfallRecords: [],
    sanitaryRecords: [],
    monthlyExchangeRates: []
  };
}

async function main() {
  loadEnvFile();

  const passwordHash = await hash(DEMO_PASSWORD, 12);
  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL });

  try {
    await connection.beginTransaction();

    await connection.query(
      `CREATE TABLE IF NOT EXISTS saas_agro_workspaces (
         id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
         tenant_id BIGINT UNSIGNED NOT NULL,
         workspace_key VARCHAR(40) NOT NULL,
         version VARCHAR(20) NOT NULL DEFAULT 'v1',
         workspace_json JSON NOT NULL,
         created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
         updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
         PRIMARY KEY (id),
         UNIQUE KEY uq_saas_agro_workspace_tenant_key (tenant_id, workspace_key),
         KEY idx_saas_agro_workspace_tenant (tenant_id)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

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
       VALUES (?, 'agro', 1)
       ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)`,
      [tenantId]
    );

    await connection.query(
      `INSERT INTO saas_agro_workspaces (tenant_id, workspace_key, version, workspace_json)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         version = VALUES(version),
         updated_at = CURRENT_TIMESTAMP`,
      [tenantId, WORKSPACE_KEY, WORKSPACE_VERSION, JSON.stringify(createEmptyWorkspace())]
    );

    await connection.commit();

    console.log(
      JSON.stringify(
        {
          ok: true,
          identifier: DEMO_IDENTIFIER,
          email: DEMO_EMAIL,
          password: DEMO_PASSWORD,
          tenantId,
          userId,
          note: "Demo aislado para agro con workspace propio por tenant."
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
