CREATE TABLE IF NOT EXISTS saas_piloto_sales (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  items_count INT UNSIGNED NOT NULL DEFAULT 0,
  payment_method ENUM('efectivo', 'tarjeta') NOT NULL DEFAULT 'efectivo',
  status ENUM('confirmed', 'cancelled') NOT NULL DEFAULT 'confirmed',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_saas_piloto_sales_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saas_piloto_sale_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sale_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NULL,
  product_name VARCHAR(180) NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  line_total DECIMAL(12,2) NOT NULL,
  image_url LONGTEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_saas_piloto_sale_items_sale (sale_id),
  CONSTRAINT fk_saas_piloto_sale_items_sale
    FOREIGN KEY (sale_id) REFERENCES saas_piloto_sales (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_saas_piloto_sale_items_product
    FOREIGN KEY (product_id) REFERENCES saas_piloto_products (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
