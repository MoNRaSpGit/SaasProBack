CREATE TABLE IF NOT EXISTS saas_neon_accounts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  account_type ENUM('cash', 'bank') NOT NULL,
  opening_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_saas_neon_accounts_name (tenant_id, name, deleted_at),
  KEY idx_saas_neon_accounts_tenant (tenant_id),
  CONSTRAINT fk_saas_neon_accounts_tenant
    FOREIGN KEY (tenant_id) REFERENCES saas_tenants (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saas_neon_movements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  movement_type ENUM('income', 'expense') NOT NULL,
  movement_date DATE NOT NULL,
  account_id BIGINT UNSIGNED NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  description VARCHAR(255) NULL,
  source_type ENUM('activity', 'independent') NOT NULL DEFAULT 'activity',
  source_activity_id BIGINT UNSIGNED NULL,
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_saas_neon_movements_tenant_date (tenant_id, movement_date),
  KEY idx_saas_neon_movements_account (account_id),
  KEY idx_saas_neon_movements_activity (source_activity_id),
  CONSTRAINT fk_saas_neon_movements_tenant
    FOREIGN KEY (tenant_id) REFERENCES saas_tenants (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_saas_neon_movements_account
    FOREIGN KEY (account_id) REFERENCES saas_neon_accounts (id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_saas_neon_movements_activity
    FOREIGN KEY (source_activity_id) REFERENCES saas_neon_activities (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saas_neon_activity_payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  activity_id BIGINT UNSIGNED NOT NULL,
  movement_id BIGINT UNSIGNED NOT NULL,
  paid_amount DECIMAL(12,2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_saas_neon_activity_payments_activity (activity_id),
  KEY idx_saas_neon_activity_payments_movement (movement_id),
  CONSTRAINT fk_saas_neon_activity_payments_tenant
    FOREIGN KEY (tenant_id) REFERENCES saas_tenants (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_saas_neon_activity_payments_activity
    FOREIGN KEY (activity_id) REFERENCES saas_neon_activities (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_saas_neon_activity_payments_movement
    FOREIGN KEY (movement_id) REFERENCES saas_neon_movements (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
