-- Esta tabla no tenia migracion propia (se creaba al vuelo desde el
-- servicio): la formalizamos aca y le agregamos row_version, usado para
-- bloqueo optimista (detectar si otro dispositivo/pestana ya guardo una
-- version mas nueva antes de pisarla). Si la tabla ya existe sin la
-- columna, el script apply-agro-workspaces-row-version-migration.js la
-- agrega por separado, porque este motor de MySQL no soporta
-- "ALTER TABLE ... ADD COLUMN IF NOT EXISTS".
CREATE TABLE IF NOT EXISTS saas_agro_workspaces (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  workspace_key VARCHAR(40) NOT NULL,
  version VARCHAR(20) NOT NULL DEFAULT 'v1',
  workspace_json JSON NOT NULL,
  row_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_saas_agro_workspace_tenant_key (tenant_id, workspace_key),
  KEY idx_saas_agro_workspace_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
