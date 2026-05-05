CREATE TABLE IF NOT EXISTS saas_neon_categories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  movement_type ENUM('income', 'expense') NOT NULL,
  classification ENUM('empresa', 'personal') NOT NULL DEFAULT 'empresa',
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_saas_neon_categories_name (tenant_id, movement_type, name, deleted_at),
  KEY idx_saas_neon_categories_tenant_type (tenant_id, movement_type),
  CONSTRAINT fk_saas_neon_categories_tenant
    FOREIGN KEY (tenant_id) REFERENCES saas_tenants (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @has_category_id := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'saas_neon_movements'
    AND COLUMN_NAME = 'category_id'
);
SET @sql_add_category_id := IF(
  @has_category_id = 0,
  'ALTER TABLE saas_neon_movements ADD COLUMN category_id BIGINT UNSIGNED NULL AFTER description',
  'SELECT 1'
);
PREPARE stmt_add_category_id FROM @sql_add_category_id;
EXECUTE stmt_add_category_id;
DEALLOCATE PREPARE stmt_add_category_id;

SET @has_idx_category := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'saas_neon_movements'
    AND INDEX_NAME = 'idx_saas_neon_movements_category'
);
SET @sql_add_idx_category := IF(
  @has_idx_category = 0,
  'ALTER TABLE saas_neon_movements ADD KEY idx_saas_neon_movements_category (category_id)',
  'SELECT 1'
);
PREPARE stmt_add_idx_category FROM @sql_add_idx_category;
EXECUTE stmt_add_idx_category;
DEALLOCATE PREPARE stmt_add_idx_category;

SET @has_fk_category := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'saas_neon_movements'
    AND CONSTRAINT_NAME = 'fk_saas_neon_movements_category'
);
SET @sql_add_fk_category := IF(
  @has_fk_category = 0,
  'ALTER TABLE saas_neon_movements ADD CONSTRAINT fk_saas_neon_movements_category FOREIGN KEY (category_id) REFERENCES saas_neon_categories (id) ON DELETE RESTRICT',
  'SELECT 1'
);
PREPARE stmt_add_fk_category FROM @sql_add_fk_category;
EXECUTE stmt_add_fk_category;
DEALLOCATE PREPARE stmt_add_fk_category;

CREATE TABLE IF NOT EXISTS saas_neon_movement_allocations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  movement_id BIGINT UNSIGNED NOT NULL,
  destination_type ENUM('activity', 'personal', 'vehicle', 'other') NOT NULL,
  destination_activity_id BIGINT UNSIGNED NULL,
  destination_label VARCHAR(255) NULL,
  amount DECIMAL(12,2) NOT NULL,
  metadata_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_saas_neon_movement_allocations_tenant (tenant_id),
  KEY idx_saas_neon_movement_allocations_movement (movement_id),
  KEY idx_saas_neon_movement_allocations_activity (destination_activity_id),
  CONSTRAINT fk_saas_neon_movement_allocations_tenant
    FOREIGN KEY (tenant_id) REFERENCES saas_tenants (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_saas_neon_movement_allocations_movement
    FOREIGN KEY (movement_id) REFERENCES saas_neon_movements (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_saas_neon_movement_allocations_activity
    FOREIGN KEY (destination_activity_id) REFERENCES saas_neon_activities (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
