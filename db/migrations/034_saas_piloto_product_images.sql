CREATE TABLE IF NOT EXISTS saas_piloto_product_images (
  product_id BIGINT UNSIGNED NOT NULL,
  image_data LONGBLOB NOT NULL,
  mime_type VARCHAR(60) NOT NULL,
  source_hash VARCHAR(64) NOT NULL,
  byte_size INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id),
  KEY idx_saas_piloto_product_images_hash (source_hash),
  CONSTRAINT fk_saas_piloto_product_images_product
    FOREIGN KEY (product_id) REFERENCES saas_piloto_products (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE saas_piloto_products
  ADD COLUMN has_image TINYINT(1) NOT NULL DEFAULT 0 AFTER image_url;
