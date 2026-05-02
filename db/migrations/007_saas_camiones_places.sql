CREATE TABLE IF NOT EXISTS saas_camiones_places (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NULL,
  name VARCHAR(160) NOT NULL,
  notes VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_saas_camiones_places_tenant_name (tenant_id, name),
  KEY idx_saas_camiones_places_tenant_active (tenant_id, is_active),
  KEY idx_saas_camiones_places_branch (branch_id),
  CONSTRAINT fk_saas_camiones_places_tenant
    FOREIGN KEY (tenant_id) REFERENCES saas_tenants(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_saas_camiones_places_branch
    FOREIGN KEY (branch_id) REFERENCES saas_branches(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO saas_camiones_places (tenant_id, branch_id, name, notes, is_active)
SELECT DISTINCT
  t.tenant_id,
  t.branch_id,
  t.place,
  'backfill from saas_camiones_trips.place',
  1
FROM saas_camiones_trips t
WHERE t.place IS NOT NULL
  AND TRIM(t.place) <> ''
ON DUPLICATE KEY UPDATE
  name = VALUES(name);
