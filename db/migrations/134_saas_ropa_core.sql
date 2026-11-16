-- frontend-ropa (15/11/2026): catalogo de ropa con buscador + tarjetas, clon
-- de frontend-qq con SU PROPIA base de datos (tablas saas_ropa_*). Esquema
-- final consolidado (en QQ vino en varias migraciones). Precio unico por
-- prenda y talles opcionales (texto separado por comas).

CREATE TABLE IF NOT EXISTS saas_ropa_products (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(200) NOT NULL,
  description VARCHAR(500) NULL,
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  sizes VARCHAR(200) NULL,
  currency VARCHAR(5) NOT NULL DEFAULT 'UYU',
  image_url VARCHAR(500) NULL,
  has_image TINYINT(1) NOT NULL DEFAULT 0,
  category VARCHAR(100) NULL,
  status ENUM('published', 'draft') NOT NULL DEFAULT 'published',
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_saas_ropa_products_status (status),
  KEY idx_saas_ropa_products_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saas_ropa_users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(191) NOT NULL,
  password_hash VARCHAR(191) NOT NULL,
  full_name VARCHAR(120) NULL,
  role ENUM('administrador', 'usuario') NOT NULL DEFAULT 'usuario',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_saas_ropa_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saas_ropa_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_saas_ropa_sessions_token (token),
  KEY idx_saas_ropa_sessions_user (user_id),
  CONSTRAINT fk_saas_ropa_sessions_user FOREIGN KEY (user_id) REFERENCES saas_ropa_users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saas_ropa_product_images (
  product_id BIGINT UNSIGNED NOT NULL,
  image_data LONGBLOB NOT NULL,
  mime_type VARCHAR(60) NOT NULL,
  source_hash VARCHAR(64) NOT NULL,
  byte_size INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id),
  KEY idx_saas_ropa_product_images_hash (source_hash),
  CONSTRAINT fk_saas_ropa_product_images_product
    FOREIGN KEY (product_id) REFERENCES saas_ropa_products (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saas_ropa_carousel_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  image_data LONGBLOB NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  source_hash CHAR(64) NOT NULL,
  byte_size INT UNSIGNED NOT NULL,
  -- Version PC opcional (16/11/2026): image_data es la de celular (1200x400),
  -- desktop_* la de PC (1920x300). Sin desktop, la PC usa la de celular.
  desktop_image_data LONGBLOB NULL,
  desktop_mime_type VARCHAR(100) NULL,
  desktop_source_hash CHAR(64) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saas_ropa_clients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  email VARCHAR(200) NULL,
  phone VARCHAR(50) NULL,
  due_date DATE NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saas_ropa_audit_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  occurred_at DATETIME NOT NULL,
  action VARCHAR(30) NOT NULL,
  entity_type VARCHAR(30) NOT NULL,
  entity_id VARCHAR(40) NULL,
  entity_label VARCHAR(255) NULL,
  actor_email VARCHAR(200) NULL,
  actor_role VARCHAR(20) NULL,
  details TEXT NULL,
  KEY idx_saas_ropa_audit_occurred (occurred_at),
  KEY idx_saas_ropa_audit_entity (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saas_ropa_discount_config (
  id TINYINT NOT NULL PRIMARY KEY DEFAULT 1,
  code VARCHAR(40) NOT NULL DEFAULT '',
  percentage TINYINT NOT NULL DEFAULT 10,
  enabled TINYINT(1) NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO saas_ropa_discount_config (id, code, percentage, enabled) VALUES (1, '', 10, 0);
