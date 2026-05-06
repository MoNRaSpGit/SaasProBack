ALTER TABLE saas_neon_accounts
  MODIFY COLUMN account_type ENUM('cash', 'bank', 'credit') NOT NULL;

SET @statement = IF(
  EXISTS(
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'saas_neon_movements'
      AND COLUMN_NAME = 'provider_name'
  ),
  'SELECT 1',
  'ALTER TABLE saas_neon_movements ADD COLUMN provider_name VARCHAR(120) NULL AFTER description'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @statement = IF(
  EXISTS(
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'saas_neon_movements'
      AND COLUMN_NAME = 'document_ref'
  ),
  'SELECT 1',
  'ALTER TABLE saas_neon_movements ADD COLUMN document_ref VARCHAR(80) NULL AFTER provider_name'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @statement = IF(
  EXISTS(
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'saas_neon_movements'
      AND COLUMN_NAME = 'quantity'
  ),
  'SELECT 1',
  'ALTER TABLE saas_neon_movements ADD COLUMN quantity DECIMAL(12,2) NULL AFTER document_ref'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @statement = IF(
  EXISTS(
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'saas_neon_movements'
      AND COLUMN_NAME = 'unit_label'
  ),
  'SELECT 1',
  'ALTER TABLE saas_neon_movements ADD COLUMN unit_label VARCHAR(40) NULL AFTER quantity'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @statement = IF(
  EXISTS(
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'saas_neon_movements'
      AND COLUMN_NAME = 'currency_code'
  ),
  'SELECT 1',
  'ALTER TABLE saas_neon_movements ADD COLUMN currency_code ENUM(''UYU'', ''USD'') NULL AFTER unit_label'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @statement = IF(
  EXISTS(
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'saas_neon_movements'
      AND COLUMN_NAME = 'credit_card_label'
  ),
  'SELECT 1',
  'ALTER TABLE saas_neon_movements ADD COLUMN credit_card_label VARCHAR(120) NULL AFTER currency_code'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @statement = IF(
  EXISTS(
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'saas_neon_movements'
      AND COLUMN_NAME = 'due_date'
  ),
  'SELECT 1',
  'ALTER TABLE saas_neon_movements ADD COLUMN due_date DATE NULL AFTER credit_card_label'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
