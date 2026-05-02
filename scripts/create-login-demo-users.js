const fs = require("fs");
const mysql = require("mysql2/promise");
const { hash } = require("bcryptjs");

const DEMO_USERS = [
  {
    email: "pos.demo@saaspro.com",
    password: "posdemo123",
    fullName: "POS Demo",
    tenantName: "POS Demo",
    tenantSlug: "pos-demo",
    modules: ["pos"]
  },
  {
    email: "operaciones.demo@saaspro.com",
    password: "opsdemo123",
    fullName: "Operaciones Demo",
    tenantName: "Operaciones Demo",
    tenantSlug: "operaciones-demo",
    modules: ["camiones", "pos"]
  }
];

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

async function ensureUser(connection, demoUser) {
  const passwordHash = await hash(demoUser.password, 12);

  const [userRows] = await connection.query(
    `SELECT id
     FROM saasPro_users
     WHERE email = ?
     LIMIT 1`,
    [demoUser.email]
  );

  let userId = userRows[0]?.id;

  if (!userId) {
    const [userResult] = await connection.query(
      `INSERT INTO saasPro_users (email, password_hash, full_name, role, is_active)
       VALUES (?, ?, ?, 'member', 1)`,
      [demoUser.email, passwordHash, demoUser.fullName]
    );
    userId = Number(userResult.insertId);
  } else {
    await connection.query(
      `UPDATE saasPro_users
       SET password_hash = ?,
           full_name = ?,
           is_active = 1
       WHERE id = ?`,
      [passwordHash, demoUser.fullName, userId]
    );
  }

  return userId;
}

async function ensureTenant(connection, demoUser) {
  const [tenantRows] = await connection.query(
    `SELECT id
     FROM saas_tenants
     WHERE slug = ?
     LIMIT 1`,
    [demoUser.tenantSlug]
  );

  let tenantId = tenantRows[0]?.id;

  if (!tenantId) {
    const [tenantResult] = await connection.query(
      `INSERT INTO saas_tenants (name, slug, status)
       VALUES (?, ?, 'active')`,
      [demoUser.tenantName, demoUser.tenantSlug]
    );
    tenantId = Number(tenantResult.insertId);
  } else {
    await connection.query(
      `UPDATE saas_tenants
       SET name = ?,
           status = 'active'
       WHERE id = ?`,
      [demoUser.tenantName, tenantId]
    );
  }

  await connection.query(
    `INSERT INTO saas_tenant_settings (tenant_id, brand_name)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE brand_name = VALUES(brand_name)`,
    [tenantId, demoUser.tenantName]
  );

  return tenantId;
}

async function ensureMembership(connection, userId, tenantId) {
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
}

async function ensureModules(connection, tenantId, modules) {
  await connection.query(
    `DELETE FROM saas_tenant_modules
     WHERE tenant_id = ?`,
    [tenantId]
  );

  for (const moduleKey of modules) {
    await connection.query(
      `INSERT INTO saas_tenant_modules (tenant_id, module_key, enabled)
       VALUES (?, ?, 1)`,
      [tenantId, moduleKey]
    );
  }
}

async function main() {
  loadEnvFile();

  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL });

  try {
    await connection.beginTransaction();

    const results = [];

    for (const demoUser of DEMO_USERS) {
      const userId = await ensureUser(connection, demoUser);
      const tenantId = await ensureTenant(connection, demoUser);
      await ensureMembership(connection, userId, tenantId);
      await ensureModules(connection, tenantId, demoUser.modules);

      results.push({
        email: demoUser.email,
        password: demoUser.password,
        tenantId,
        userId,
        modules: demoUser.modules
      });
    }

    await connection.commit();
    console.log(JSON.stringify({ ok: true, users: results }, null, 2));
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
