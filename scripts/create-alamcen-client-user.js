const fs = require("fs");
const mysql = require("mysql2/promise");
const { hash } = require("bcryptjs");

const CLIENT_EMAIL = "almacen@saaspro.local";
const CLIENT_FULL_NAME = "Almacen Principal";
const CLIENT_TENANT_NAME = "Almacen Principal";
const CLIENT_TENANT_SLUG = "almacen-principal";

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

  const clientPassword = getRequiredEnv("ALAMCEN_CLIENT_PASSWORD");
  const passwordHash = await hash(clientPassword, 12);
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
         SET password_hash = ?,
             full_name = ?,
             is_active = 1
         WHERE id = ?`,
        [passwordHash, CLIENT_FULL_NAME, userId]
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
       VALUES (?, 'alamcen', 1)
       ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)`,
      [tenantId]
    );

    const [importResult] = await connection.query(
      `INSERT INTO saas_alamcen_products (
         tenant_id,
         legacy_product_id,
         name,
         description,
         barcode,
         barcode_normalized,
         sale_price,
         list_price,
         stock_current,
         category,
         image_url,
         status,
         source
       )
       SELECT
         ? AS tenant_id,
         COALESCE(legacy_producto_id, id) AS legacy_product_id,
         LEFT(COALESCE(NULLIF(TRIM(nombre), ''), CONCAT('Producto ', id)), 180) AS name,
         LEFT(NULLIF(TRIM(descripcion), ''), 255) AS description,
         LEFT(NULLIF(TRIM(barcode), ''), 80) AS barcode,
         LEFT(TRIM(barcode_normalized), 80) AS barcode_normalized,
         COALESCE(NULLIF(precio_venta, 0), 0) AS sale_price,
         NULLIF(precio_lista, 0) AS list_price,
         COALESCE(stock_actual, 0) AS stock_current,
         LEFT(NULLIF(TRIM(COALESCE(categoria_compact, categoria)), ''), 120) AS category,
         imagen AS image_url,
         CASE
           WHEN estado = 'inactivo' THEN 'inactive'
           WHEN estado = 'sin_stock' THEN 'out_of_stock'
           WHEN estado = 'archivado' THEN 'archived'
           ELSE 'active'
         END AS status,
         'catalog' AS source
       FROM ops_producto
       WHERE barcode_normalized IS NOT NULL
         AND TRIM(barcode_normalized) <> ''
         AND barcode IS NOT NULL
         AND TRIM(barcode) <> ''
       ON DUPLICATE KEY UPDATE
         legacy_product_id = VALUES(legacy_product_id),
         name = VALUES(name),
         description = VALUES(description),
         sale_price = VALUES(sale_price),
         list_price = VALUES(list_price),
         stock_current = VALUES(stock_current),
         category = VALUES(category),
         image_url = VALUES(image_url),
         status = VALUES(status),
         source = VALUES(source),
         deleted_at = NULL`,
      [tenantId]
    );

    await connection.commit();

    const [productRows] = await connection.query(
      `SELECT COUNT(*) AS productCount
       FROM saas_alamcen_products
       WHERE tenant_id = ?
         AND deleted_at IS NULL`,
      [tenantId]
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          email: CLIENT_EMAIL,
          passwordConfigured: true,
          tenantId,
          userId,
          importedOrUpdatedRows: importResult.affectedRows,
          productCount: Number(productRows[0]?.productCount || 0)
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
