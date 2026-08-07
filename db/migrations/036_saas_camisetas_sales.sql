CREATE TABLE IF NOT EXISTS saas_camisetas_sales (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id VARCHAR(40) NOT NULL,
  product_name VARCHAR(160) NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL,
  mp_payment_id VARCHAR(60) NOT NULL,
  mp_preference_id VARCHAR(80) NULL,
  mp_status VARCHAR(30) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_saas_camisetas_sales_payment (mp_payment_id),
  KEY idx_saas_camisetas_sales_product (product_id),
  KEY idx_saas_camisetas_sales_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
