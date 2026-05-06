CREATE TABLE IF NOT EXISTS saas_agro_discovery_responses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  module_key VARCHAR(50) NOT NULL DEFAULT 'agro',
  version VARCHAR(20) NOT NULL DEFAULT 'v1',
  answered_at DATETIME NOT NULL,
  answers_json JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_saas_agro_discovery_tenant_answered (tenant_id, answered_at DESC),
  CONSTRAINT fk_saas_agro_discovery_tenant
    FOREIGN KEY (tenant_id) REFERENCES saas_tenants(id)
      ON UPDATE CASCADE
      ON DELETE CASCADE
);
