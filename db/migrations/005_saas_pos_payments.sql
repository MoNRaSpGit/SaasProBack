-- SaasPro POS payments schema
-- Outgoing cash movements for POS tenants.

CREATE TABLE IF NOT EXISTS saas_pos_payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  external_id VARCHAR(120) NULL,
  amount DECIMAL(10, 2) NOT NULL,
  description VARCHAR(255) NULL,
  status ENUM('confirmed', 'cancelled') NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_saas_pos_payments_tenant_external (tenant_id, external_id),
  KEY idx_saas_pos_payments_tenant_created (tenant_id, created_at),
  KEY idx_saas_pos_payments_tenant_status (tenant_id, status),
  CONSTRAINT fk_saas_pos_payments_tenant
    FOREIGN KEY (tenant_id) REFERENCES saas_tenants(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_saas_pos_payments_branch
    FOREIGN KEY (branch_id) REFERENCES saas_branches(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_saas_pos_payments_user
    FOREIGN KEY (user_id) REFERENCES saasPro_users(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
