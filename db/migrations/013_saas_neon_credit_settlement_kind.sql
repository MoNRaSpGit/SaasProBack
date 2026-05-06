SET @statement = IF(
  EXISTS(
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'saas_neon_movements'
      AND COLUMN_NAME = 'expense_kind'
  ),
  'SELECT 1',
  'ALTER TABLE saas_neon_movements ADD COLUMN expense_kind ENUM(''operational'', ''credit_settlement'') NULL AFTER currency_code'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
