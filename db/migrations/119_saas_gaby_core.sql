-- Gaby Almacen (07/11/2026): version BASICA de Piloto para una clienta
-- nueva. Tablas propias (saas_gaby_*), mismo esquema final que Piloto sin
-- cajas / tablet del fondo / precios / tickets.
CREATE TABLE IF NOT EXISTS saas_gaby_products (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(180) NOT NULL,
  barcode VARCHAR(80) NOT NULL,
  barcode_normalized VARCHAR(80) NOT NULL,
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  stock DECIMAL(12,2) NOT NULL DEFAULT 0,
  has_image TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_saas_gaby_products_barcode (barcode_normalized),
  KEY idx_saas_gaby_products_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saas_gaby_product_images (
  product_id BIGINT UNSIGNED NOT NULL,
  image_data LONGBLOB NULL,
  mime_type VARCHAR(60) NOT NULL,
  cloudinary_url VARCHAR(500) NULL,
  cloudinary_public_id VARCHAR(255) NULL,
  source_hash VARCHAR(64) NOT NULL,
  byte_size INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id),
  KEY idx_saas_gaby_product_images_hash (source_hash),
  CONSTRAINT fk_saas_gaby_product_images_product
    FOREIGN KEY (product_id) REFERENCES saas_gaby_products (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saas_gaby_sales (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  items_count INT UNSIGNED NOT NULL DEFAULT 0,
  payment_method ENUM('efectivo', 'tarjeta', 'credito') NOT NULL DEFAULT 'efectivo',
  status ENUM('confirmed', 'cancelled') NOT NULL DEFAULT 'confirmed',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_saas_gaby_sales_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saas_gaby_sale_items (
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
  KEY idx_saas_gaby_sale_items_sale (sale_id),
  CONSTRAINT fk_saas_gaby_sale_items_sale
    FOREIGN KEY (sale_id) REFERENCES saas_gaby_sales (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_saas_gaby_sale_items_product
    FOREIGN KEY (product_id) REFERENCES saas_gaby_products (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saas_gaby_clients (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(40) NULL,
  address VARCHAR(200) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saas_gaby_account_entries (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  sale_id BIGINT UNSIGNED NULL,
  total DECIMAL(10,2) NOT NULL,
  items JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_gaby_account_entry_client FOREIGN KEY (client_id) REFERENCES saas_gaby_clients (id) ON DELETE CASCADE,
  CONSTRAINT fk_gaby_account_entry_sale FOREIGN KEY (sale_id) REFERENCES saas_gaby_sales (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saas_gaby_audit_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  occurred_at DATETIME NOT NULL,
  action VARCHAR(30) NOT NULL,
  entity_type VARCHAR(30) NOT NULL,
  entity_id VARCHAR(40) NULL,
  entity_label VARCHAR(255) NULL,
  actor_email VARCHAR(200) NULL,
  actor_role VARCHAR(20) NULL,
  details TEXT NULL,
  KEY idx_saas_gaby_audit_occurred (occurred_at),
  KEY idx_saas_gaby_audit_entity (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
